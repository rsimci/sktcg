// ============================================================
// SK TCG — ENDPOINT TEMPORÁRIO DE TESTE
// Simula a aprovação de um pedido como se o MP tivesse notificado
// REMOVER ANTES DE IR PARA PRODUÇÃO
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id obrigatório' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'approved',
      mp_payment_id: 'TEST-FAKE-PAYMENT-ID',
      mp_payment_status: 'approved',
    })
    .eq('id', order_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  return res.status(200).json({ ok: true, order: data });
};
