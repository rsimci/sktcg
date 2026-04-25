// ============================================================
// SK TCG — Serverless Function
// POST /api/frete
//
// Recebe: { cepDestino, pesoGramas }
// Retorna: [{ servico, nome, preco, prazo }]
// Tenta Brasil API; fallback para tabela fixa por região.
// ============================================================

const CEP_ORIGEM = '13214010';

// Tabela fallback por faixa de CEP / UF
const FALLBACK_TABLE = [
  { nome: 'Capital SP',     faixas: [[1000,9999]],       pac: 15, sedex: 25, prazo_pac: 5,  prazo_sedex: 2 },
  { nome: 'Interior SP',    faixas: [[10000,19999]],      pac: 18, sedex: 28, prazo_pac: 7,  prazo_sedex: 3 },
  { nome: 'Minas Gerais',   faixas: [[30000,39999]],      pac: 20, sedex: 30, prazo_pac: 7,  prazo_sedex: 3 },
  { nome: 'Rio de Janeiro', faixas: [[20000,28999]],      pac: 22, sedex: 35, prazo_pac: 7,  prazo_sedex: 3 },
  { nome: 'Espírito Santo', faixas: [[29000,29999]],      pac: 22, sedex: 35, prazo_pac: 8,  prazo_sedex: 3 },
  { nome: 'Sul',            faixas: [[80000,99999]],      pac: 22, sedex: 35, prazo_pac: 9,  prazo_sedex: 4 },
  { nome: 'Centro-Oeste',   faixas: [[70000,79999],[73000,77999]], pac: 28, sedex: 42, prazo_pac: 10, prazo_sedex: 4 },
  { nome: 'Nordeste',       faixas: [[40000,65999]],      pac: 32, sedex: 48, prazo_pac: 12, prazo_sedex: 5 },
  { nome: 'Norte',          faixas: [[66000,69999]],      pac: 38, sedex: 58, prazo_pac: 15, prazo_sedex: 7 },
];

function fallbackPorCep(cep) {
  const num = parseInt(cep.replace(/\D/g, ''), 10);
  for (const r of FALLBACK_TABLE) {
    for (const [min, max] of r.faixas) {
      if (num >= min && num <= max) {
        return [
          { servico: '04510', nome: 'PAC',   preco: r.pac,   prazo: r.prazo_pac   },
          { servico: '04014', nome: 'SEDEX', preco: r.sedex, prazo: r.prazo_sedex },
        ];
      }
    }
  }
  // Default genérico se não encontrar região
  return [
    { servico: '04510', nome: 'PAC',   preco: 35, prazo: 12 },
    { servico: '04014', nome: 'SEDEX', preco: 52, prazo: 5  },
  ];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://sktcg.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cepDestino, pesoGramas = 300 } = req.body || {};

  if (!cepDestino || !/^\d{5}-?\d{3}$/.test(cepDestino.trim())) {
    return res.status(400).json({ error: 'CEP inválido' });
  }

  const cepLimpo = cepDestino.replace(/\D/g, '');

  // Tenta Brasil API
  try {
    const peso = Math.max(100, Math.min(30000, Number(pesoGramas)));
    const url = 'https://brasilapi.com.br/api/correios/v1/prazo-e-preco';
    const body = {
      cepOrigem: CEP_ORIGEM,
      cepDestino: cepLimpo,
      peso: (peso / 1000).toFixed(3), // kg
      comprimento: 20,
      largura: 15,
      altura: 10,
      servicos: ['04510', '04014'],
    };

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const opcoes = data
          .filter(s => s.erro !== 'true' && parseFloat(s.valor) > 0)
          .map(s => ({
            servico: s.codigo,
            nome: s.codigo === '04014' ? 'SEDEX' : 'PAC',
            preco: parseFloat(s.valor.replace(',', '.')),
            prazo: parseInt(s.prazo, 10),
          }));

        if (opcoes.length > 0) {
          return res.status(200).json({ opcoes, fonte: 'brasilapi' });
        }
      }
    }
  } catch (_) {
    // Silencioso — cai no fallback
  }

  // Fallback: tabela fixa
  const opcoes = fallbackPorCep(cepLimpo);
  return res.status(200).json({ opcoes, fonte: 'fallback' });
};
