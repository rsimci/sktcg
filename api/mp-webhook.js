// ============================================================
// SK TCG — Vercel Serverless Function
// POST /api/mp-webhook
//
// O Mercado Pago chama este endpoint quando o status de um
// pagamento muda. A função:
//   1. Ignora tudo que não seja notificação de 'payment'
//   2. Busca os detalhes do pagamento na API do MP
//   3. Atualiza o pedido no Supabase (status + mp_payment_id)
//      → O trigger de estoque no banco cuida do decremento
//        automático quando status vira 'approved'
//
// Env vars necessárias (as mesmas de create-preference.js):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// Mapeamento do status do MP para o status interno do pedido
const STATUS_MAP = {
  approved:     'approved',
  pending:      'pending',
  in_process:   'pending',
  authorized:   'pending',
  rejected:     'cancelled',
  cancelled:    'cancelled',
  refunded:     'refunded',
  charged_back: 'refunded',
};

module.exports = async (req, res) => {
  // MP faz um GET para validar o endpoint antes de ativar
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, data } = req.body || {};

  // Só processa notificações de pagamento
  if (type !== 'payment') {
    return res.status(200).json({ ignored: true, type });
  }

  const paymentId = data?.id;
  if (!paymentId) {
    return res.status(400).json({ error: 'Payment ID ausente' });
  }

  // Busca detalhes do pagamento na API do MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });

  if (!mpRes.ok) {
    console.error('[SK TCG] Falha ao buscar pagamento no MP:', paymentId);
    return res.status(500).json({ error: 'Falha ao consultar pagamento no Mercado Pago' });
  }

  const payment = await mpRes.json();

  const orderId  = payment.external_reference; // ID do pedido que salvamos na preferência
  const mpStatus = payment.status;             // status retornado pelo MP

  if (!orderId) {
    console.error('[SK TCG] external_reference ausente no pagamento:', paymentId);
    return res.status(400).json({ error: 'external_reference ausente' });
  }

  const newStatus = STATUS_MAP[mpStatus] || 'pending';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase
    .from('orders')
    .update({
      mp_payment_id:     String(paymentId),
      mp_payment_status: mpStatus,
      status:            newStatus,
    })
    .eq('id', orderId);

  if (error) {
    console.error('[SK TCG] Erro ao atualizar pedido no Supabase:', error);
    return res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }

  console.log(`[SK TCG] Pedido ${orderId} atualizado → ${newStatus} (mp: ${mpStatus})`);
  return res.status(200).json({ ok: true, order_id: orderId, status: newStatus });
};
