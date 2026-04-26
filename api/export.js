// ============================================================
// SK TCG — Vercel Serverless Function
// GET /api/export?type=produtos|pedidos
//
// Gera um arquivo .xlsx formatado com a identidade visual SK TCG.
// Requer header Authorization: Bearer <supabase_access_token>
// Verifica se o usuário é admin antes de exportar.
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');

// ── Paleta SK TCG ──
const C = {
  navyDark: 'FF0F1328', purple: 'FF7C3AED', purpleLight: 'FFA855F7',
  purpleFaint: 'FFF0EBFF', white: 'FFFFFFFF', textGray: 'FF9B9BB0',
  borderGray: 'FFE5E7EB', rowAlt: 'FFF9F7FF',
  green: 'FF15803D', greenBg: 'FFDCFCE7',
  red: 'FFB91C1C',   redBg: 'FFFEE2E2',
  gold: 'FFB45309',  goldBg: 'FFFEF3C7',
  blue: 'FF1D4ED8',  blueBg: 'FFEFF6FF',
  gray: 'FF6B7280',  grayBg: 'FFF3F4F6',
  dark: 'FF1F2937',
};

const CAT_LABEL = {
  'booster-packs': 'Booster Packs',
  'boxes': 'Boxes / ETB',
  'singles': 'Singles',
  'graded': 'Graded',
  'accessories': 'Acessórios',
};

const STATUS_MAP = {
  pending:   'Pendente',
  approved:  'Aprovado',
  shipped:   'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded:  'Reembolsado',
};

const ORDER_STATUS_STYLE = {
  pending:   { fill: C.goldBg,     font: C.gold   },
  approved:  { fill: C.blueBg,     font: C.blue   },
  shipped:   { fill: C.purpleFaint,font: C.purple },
  delivered: { fill: C.greenBg,    font: C.green  },
  cancelled: { fill: C.grayBg,     font: C.gray   },
  refunded:  { fill: C.redBg,      font: C.red    },
};

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thin(argb) {
  return { style: 'thin', color: { argb } };
}

function borders(argb = C.borderGray) {
  return { top: thin(argb), bottom: thin(argb), left: thin(argb), right: thin(argb) };
}

function applyCell(cell, { fillArgb, fontArgb = C.dark, bold = false, sz = 10, fontName = 'Arial', halign = 'left', numFmt = null, showBorders = true }) {
  if (fillArgb) cell.fill = solid(fillArgb);
  cell.font = { name: fontName, size: sz, bold, color: { argb: fontArgb } };
  cell.alignment = { horizontal: halign, vertical: 'middle', wrapText: false };
  if (showBorders) cell.border = borders();
  if (numFmt) cell.numFmt = numFmt;
}

function buildTitleBlock(ws, title, subtitle, ncols) {
  ws.mergeCells(1, 1, 1, ncols);
  ws.mergeCells(2, 1, 2, ncols);
  ws.mergeCells(3, 1, 3, ncols);
  ws.mergeCells(4, 1, 4, ncols);

  ws.getRow(1).height = 38;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 5;
  ws.getRow(4).height = 5;

  const t = ws.getCell(1, 1);
  t.value = title;
  applyCell(t, { fillArgb: C.navyDark, fontArgb: C.purpleLight, bold: true, sz: 18, showBorders: false });

  const s = ws.getCell(2, 1);
  s.value = subtitle;
  applyCell(s, { fillArgb: C.navyDark, fontArgb: C.textGray, sz: 11, showBorders: false });

  for (let r = 3; r <= 4; r++) {
    ws.getCell(r, 1).fill = solid(C.navyDark);
  }
}

function buildColHeaders(ws, headers, rowIdx) {
  ws.getRow(rowIdx).height = 26;
  headers.forEach((h, ci) => {
    const cell = ws.getCell(rowIdx, ci + 1);
    cell.value = h;
    applyCell(cell, { fillArgb: C.purple, fontArgb: C.white, bold: true, sz: 10, halign: 'center', showBorders: false });
  });
}

const BRL = '"R$" #,##0.00';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://sktcg.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type } = req.query;
  if (!['produtos', 'pedidos'].includes(type)) {
    return res.status(400).json({ error: 'type deve ser "produtos" ou "pedidos"' });
  }

  // Verifica autenticação
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Valida token e verifica is_admin
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) return res.status(403).json({ error: 'Acesso negado' });

  const now = new Date();
  const todayStr = now.toLocaleString('pt-BR');
  const fileDate = now.toISOString().slice(0, 10);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SK TCG Admin';

  // ══════════════ PRODUTOS ══════════════
  if (type === 'produtos') {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const headers = ['Nome', 'SKU', 'Edição', 'Categoria', 'Tipo', 'Preço (R$)', 'Ant. (R$)', 'Custo (R$)', 'Estoque', 'Status', 'Peso (g)', 'Badge', 'Cadastrado em'];
    const colWidths = [34, 13, 17, 16, 10, 13, 12, 12, 9, 10, 9, 9, 14];
    const NC = headers.length;

    const ws = wb.addWorksheet('Produtos');
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    headers.forEach((_, i) => { ws.getColumn(i + 1).width = colWidths[i]; });

    buildTitleBlock(ws, 'SK TCG', `Exportação de Produtos  ·  ${todayStr}`, NC);
    buildColHeaders(ws, headers, 5);

    data.forEach((p, ri) => {
      const rowIdx = 6 + ri;
      const ev = ri % 2 === 1;
      const bg = ev ? C.rowAlt : C.white;
      ws.getRow(rowIdx).height = 19;

      const values = [
        p.name || '', p.sku || '', p.edition || '',
        CAT_LABEL[p.category] || p.category || '', p.ptype || '',
        parseFloat(p.price) || 0,
        p.old_price  ? parseFloat(p.old_price)  : null,
        p.cost_price ? parseFloat(p.cost_price) : null,
        parseInt(p.stock_qty) || 0,
        p.active ? 'Ativo' : 'Inativo',
        p.weight || null, p.badge || '',
        p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '',
      ];

      values.forEach((v, ci) => {
        const cell = ws.getCell(rowIdx, ci + 1);
        cell.value = v;
        if ([5, 6, 7].includes(ci)) {
          applyCell(cell, { fillArgb: bg, sz: 10, halign: 'right', numFmt: BRL });
        } else if (ci === 8) {
          applyCell(cell, { fillArgb: bg, sz: 10, halign: 'center' });
        } else if (ci === 9) {
          const active = v === 'Ativo';
          applyCell(cell, { fillArgb: active ? C.greenBg : C.redBg, fontArgb: active ? C.green : C.red, bold: true, sz: 10, halign: 'center' });
        } else {
          applyCell(cell, { fillArgb: bg, sz: 10 });
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sktcg-produtos-${fileDate}.xlsx"`);
    return res.status(200).send(Buffer.from(buf));
  }

  // ══════════════ PEDIDOS ══════════════
  if (type === 'pedidos') {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const headers = ['Pedido #', 'Data', 'Cliente', 'Subtotal (R$)', 'Frete (R$)', 'Total (R$)', 'Status', 'Serviço', 'Rastreio', 'Endereço de Entrega'];
    const colWidths = [12, 18, 23, 14, 12, 14, 14, 12, 22, 50];
    const NC = headers.length;

    const ws = wb.addWorksheet('Pedidos');
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    headers.forEach((_, i) => { ws.getColumn(i + 1).width = colWidths[i]; });

    buildTitleBlock(ws, 'SK TCG', `Exportação de Pedidos  ·  ${todayStr}`, NC);
    buildColHeaders(ws, headers, 5);

    data.forEach((o, ri) => {
      const rowIdx = 6 + ri;
      const ev = ri % 2 === 1;
      const bg = ev ? C.rowAlt : C.white;
      ws.getRow(rowIdx).height = 19;

      const addr = o.shipping_address || {};
      const addrStr = addr.street
        ? `${addr.street}, ${addr.number}${addr.complement ? ' ' + addr.complement : ''} — ${addr.neighborhood}, ${addr.city}/${addr.state} — CEP ${addr.cep}`
        : '';

      const values = [
        o.id.slice(0, 8),
        o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '',
        o.profiles?.name || '',
        parseFloat(o.subtotal) || 0,
        parseFloat(o.shipping_cost) || 0,
        parseFloat(o.total) || 0,
        STATUS_MAP[o.status] || o.status || '',
        o.shipping_service || '',
        o.tracking_code || '',
        addrStr,
      ];

      values.forEach((v, ci) => {
        const cell = ws.getCell(rowIdx, ci + 1);
        cell.value = v;
        if ([3, 4, 5].includes(ci)) {
          applyCell(cell, { fillArgb: bg, sz: 10, halign: 'right', numFmt: BRL });
        } else if (ci === 6) {
          const st = ORDER_STATUS_STYLE[o.status] || { fill: bg, font: C.dark };
          applyCell(cell, { fillArgb: st.fill, fontArgb: st.font, bold: true, sz: 10, halign: 'center' });
        } else if (ci === 0) {
          applyCell(cell, { fillArgb: bg, fontName: 'Courier New', sz: 10, halign: 'center' });
        } else {
          applyCell(cell, { fillArgb: bg, sz: 10 });
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sktcg-pedidos-${fileDate}.xlsx"`);
    return res.status(200).send(Buffer.from(buf));
  }
};
