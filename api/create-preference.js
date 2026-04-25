// ============================================================
// SK TCG — Vercel Serverless Function
// POST /api/create-preference
//
// Fluxo:
//   1. Recebe carrinho + user_id + endereço do frontend
//   2. Busca preços reais no Supabase (não confia no cliente)
//   3. Cria pedido no Supabase com status 'pending'
//   4. Cria preferência no Mercado Pago
//   5. Salva mp_preference_id no pedido
//   6. Retorna links de checkout (init_point e sandbox_init_point)
//
// Env vars necessárias (configurar na Vercel):
//   MP_ACCESS_TOKEN         — token de acesso do Mercado Pago
//   SUPABASE_URL            — https://<projeto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — chave service_role (bypassa RLS)
//   SITE_URL                — https://sktcg.com.br
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // CORS para chamadas do próprio site
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://sktcg.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cart, user_id, shipping_address, shipping_cost = 0, shipping_service = null } = req.body;

  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'Carrinho vazio' });
  }
  if (!user_id) {
    return res.status(400).json({ error: 'Usuário não autenticado' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Busca preços reais no Supabase
  const productIds = cart.map(i => i.id);
  const { data: dbProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, stock_qty, img_url')
    .in('id', productIds)
    .eq('active', true);

  if (productsError || !dbProducts || dbProducts.length === 0) {
    return res.status(400).json({ error: 'Produtos inválidos ou indisponíveis' });
  }

  // 2. Monta itens com preços validados
  const items = cart.map(cartItem => {
    const product = dbProducts.find(p => p.id === cartItem.id);
    if (!product) return null;
    return {
      id: product.id,
      title: product.name,
      quantity: Number(cartItem.qty),
      unit_price: parseFloat(product.price),
      currency_id: 'BRL',
    };
  }).filter(Boolean);

  if (items.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto válido no carrinho' });
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const freteValor = parseFloat(shipping_cost) || 0;

  // Adiciona frete como item separado no MP (se houver)
  if (freteValor > 0) {
    items.push({
      id: 'frete',
      title: `Frete ${shipping_service || 'PAC'}`,
      quantity: 1,
      unit_price: parseFloat(freteValor.toFixed(2)),
      currency_id: 'BRL',
    });
  }

  // 3. Cria pedido no Supabase como 'pending'
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id,
      status: 'pending',
      subtotal: parseFloat(subtotal.toFixed(2)),
      shipping_cost: parseFloat(freteValor.toFixed(2)),
      shipping_service: shipping_service || null,
      total: parseFloat((subtotal + freteValor).toFixed(2)),
      shipping_address: shipping_address || null,
    })
    .select()
    .single();

  if (orderError) {
    console.error('[SK TCG] Order insert error:', orderError);
    return res.status(500).json({ error: 'Erro ao criar pedido' });
  }

  // 4. Insere itens do pedido
  const orderItems = cart.map(cartItem => {
    const product = dbProducts.find(p => p.id === cartItem.id);
    return {
      order_id: order.id,
      product_id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      qty: Number(cartItem.qty),
      img_url: product.img_url || null,
    };
  });

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('[SK TCG] Order items insert error:', itemsError);
    await supabase.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: 'Erro ao registrar itens do pedido' });
  }

  // 5. Cria preferência no Mercado Pago
  const siteUrl = process.env.SITE_URL || 'https://sktcg.com.br';

  const preference = {
    items,
    external_reference: order.id,
    back_urls: {
      success: `${siteUrl}/?checkout_status=approved&order_id=${order.id}`,
      failure: `${siteUrl}/?checkout_status=rejected&order_id=${order.id}`,
      pending: `${siteUrl}/?checkout_status=pending&order_id=${order.id}`,
    },
    notification_url: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? `${siteUrl}/api/mp-webhook?x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}`
      : `${siteUrl}/api/mp-webhook`,
    payment_methods: {
      installments: 12,
    },
    statement_descriptor: 'SK TCG',
  };

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  const mpData = await mpRes.json();

  if (!mpRes.ok) {
    console.error('[SK TCG] MP preference error:', mpData);
    // Remove o pedido pois o MP falhou
    await supabase.from('order_items').delete().eq('order_id', order.id);
    await supabase.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: 'Erro ao criar preferência no Mercado Pago' });
  }

  // 6. Salva mp_preference_id no pedido
  await supabase
    .from('orders')
    .update({ mp_preference_id: mpData.id })
    .eq('id', order.id);

  return res.status(200).json({
    order_id: order.id,
    preference_id: mpData.id,
    init_point: mpData.init_point,               // produção
    sandbox_init_point: mpData.sandbox_init_point, // testes
  });
};
