// ============================================================
// SK TCG — Vercel Serverless Function
// POST /api/mp-webhook
//
// Env vars necessárias:
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY, ADMIN_EMAIL, SITE_URL
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

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

function fmtBRL(val) {
  return 'R$ ' + parseFloat(val || 0).toFixed(2).replace('.', ',');
}

function shortId(uuid) {
  return (uuid || '').split('-')[0].toUpperCase();
}

async function sendEmails(supabase, orderId, newStatus) {
  if (newStatus !== 'approved') return; // só envia e-mails para pedidos aprovados

  // Busca pedido completo com itens e perfil do cliente
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(name, qty, price), profiles(name, phone)')
    .eq('id', orderId)
    .single();

  if (!order) return;

  // Busca e-mail do cliente via auth.admin
  const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
  const customerEmail = userData?.user?.email;
  const customerName  = order.profiles?.name || 'Cliente';

  const resend  = new Resend(process.env.RESEND_API_KEY);
  const adminEmail = process.env.ADMIN_EMAIL || 'rafaelsimci@gmail.com';
  const siteUrl = process.env.SITE_URL || 'https://sktcg.com.br';
  const id = shortId(order.id);

  const itemsRows = (order.order_items || []).map(i =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center">${i.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">${fmtBRL(i.price * i.qty)}</td>
    </tr>`
  ).join('');

  // ── E-mail para o vendedor ──────────────────────────────────
  await resend.emails.send({
    from:    'SK TCG <no-reply@sktcg.com.br>',
    to:      [adminEmail],
    subject: `🛍️ Novo pedido #${id} — ${fmtBRL(order.total)}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A">
        <h2 style="color:#0D1B2A">Novo pedido aprovado</h2>
        <p><strong>Pedido:</strong> #${id}</p>
        <p><strong>Cliente:</strong> ${customerName} — ${customerEmail || '—'}</p>
        <p><strong>Telefone:</strong> ${order.profiles?.phone || '—'}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="font-size:11px;color:#666;text-transform:uppercase">
              <th style="text-align:left;padding-bottom:6px">Produto</th>
              <th style="text-align:center;padding-bottom:6px">Qtd</th>
              <th style="text-align:right;padding-bottom:6px">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <p style="font-size:18px;font-weight:600">Total: ${fmtBRL(order.total)}</p>
        <a href="${siteUrl}/admin.html#/pedidos/${order.id}"
           style="display:inline-block;margin-top:12px;padding:12px 24px;background:#0D1B2A;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">
          Ver pedido no admin →
        </a>
      </div>`,
  }).catch(e => console.error('[SK TCG] Erro e-mail vendedor:', e));

  // ── E-mail para o cliente ───────────────────────────────────
  if (customerEmail) {
    await resend.emails.send({
      from:    'SK TCG <no-reply@sktcg.com.br>',
      to:      [customerEmail],
      subject: `Pedido #${id} confirmado — SK TCG`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A">
          <h2 style="color:#0D1B2A">Olá, ${customerName.split(' ')[0]}! 👋</h2>
          <p>Seu pedido foi <strong>aprovado</strong> e está sendo preparado com cuidado.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="font-size:11px;color:#666;text-transform:uppercase">
                <th style="text-align:left;padding-bottom:6px">Produto</th>
                <th style="text-align:center;padding-bottom:6px">Qtd</th>
                <th style="text-align:right;padding-bottom:6px">Total</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <p style="font-size:18px;font-weight:600">Total: ${fmtBRL(order.total)}</p>
          <p style="color:#555;font-size:13px;margin-top:16px">
            Assim que seu pedido for enviado, você receberá o código de rastreamento.<br>
            Qualquer dúvida, é só responder este e-mail.
          </p>
          <a href="${siteUrl}"
             style="display:inline-block;margin-top:12px;padding:12px 24px;background:#7C3AED;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">
            Voltar à loja →
          </a>
          <p style="color:#aaa;font-size:11px;margin-top:24px">SK TCG — Pokémon TCG original, com quem entende do assunto.</p>
        </div>`,
    }).catch(e => console.error('[SK TCG] Erro e-mail cliente:', e));
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, data } = req.body || {};

  if (type !== 'payment') {
    return res.status(200).json({ ignored: true, type });
  }

  const paymentId = data?.id;
  if (!paymentId) return res.status(400).json({ error: 'Payment ID ausente' });

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });

  if (!mpRes.ok) {
    console.error('[SK TCG] Falha ao buscar pagamento no MP:', paymentId);
    return res.status(500).json({ error: 'Falha ao consultar pagamento no Mercado Pago' });
  }

  const payment  = await mpRes.json();
  const orderId  = payment.external_reference;
  const mpStatus = payment.status;

  if (!orderId) {
    console.error('[SK TCG] external_reference ausente:', paymentId);
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
    console.error('[SK TCG] Erro ao atualizar pedido:', error);
    return res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }

  // Dispara e-mails em background (não bloqueia o retorno para o MP)
  sendEmails(supabase, orderId, newStatus).catch(e =>
    console.error('[SK TCG] Erro ao enviar e-mails:', e)
  );

  console.log(`[SK TCG] Pedido ${orderId} → ${newStatus} (mp: ${mpStatus})`);
  return res.status(200).json({ ok: true, order_id: orderId, status: newStatus });
};
