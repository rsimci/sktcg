-- ============================================================
-- Migração de produtos — Maio 2026
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Adicionar coluna language (se ainda não feito)
alter table public.products
  add column if not exists language text; -- 'Português' | 'Inglês'

-- ============================================================
-- 2. Atualizar produtos existentes
-- ============================================================

-- ETB — Ascended Heroes: preço, estoque, categoria, tipo e idioma atualizados
update public.products
  set price = 599.90, stock_qty = 2, language = 'Inglês', category = 'etbs', ptype = 'ETB'
  where name = 'ETB — Ascended Heroes' and edition = 'Ascended Heroes';

-- Mini Tin — Ascended Heroes: preço, categoria e tipo atualizados
update public.products
  set price = 129.90, stock_qty = 10, language = 'Inglês', category = 'boxes', ptype = 'Mini Tin'
  where name = 'Mini Tin — Ascended Heroes' and edition = 'Ascended Heroes';

-- 3-Pack Blister — Perfect Order: preço e tipo atualizados
update public.products
  set price = 109.90, stock_qty = 24, language = 'Inglês', category = 'booster-packs', ptype = 'Blister'
  where name = '3-Pack Blister — Perfect Order' and edition = 'Perfect Order';

-- ETB — Perfect Order: preço, estoque, categoria e tipo atualizados
update public.products
  set price = 379.90, stock_qty = 8, language = 'Inglês', category = 'etbs', ptype = 'ETB'
  where name = 'ETB — Perfect Order' and edition = 'Perfect Order';

-- Booster Bundle — Ascended Heroes: fora do estoque atual, desativar
update public.products
  set active = false
  where name = 'Booster Bundle — Ascended Heroes' and edition = 'Ascended Heroes';

-- ============================================================
-- 3. Inserir produtos novos
-- ============================================================

insert into public.products
  (name, edition, category, ptype, price, stock_qty, language, description, specs, active)
values

-- Português — Equilíbrio Perfeito
(
  'Pokemon Box 36 Booster — Equilíbrio Perfeito',
  'Equilíbrio Perfeito', 'boxes', 'Box', 399.90, 4, 'Português',
  'Box com 36 Booster Packs da expansão Scarlet & Violet — Equilíbrio Perfeito em português. Ideal para colecionadores que buscam volume e variedade de pulls.',
  '{"Edição":"Scarlet & Violet — Equilíbrio Perfeito","Conteúdo":"36 Booster Packs","Idioma":"Português","Formato":"Box lacrada"}',
  true
),
(
  'Blister Quadruplo — Equilíbrio Perfeito',
  'Equilíbrio Perfeito', 'booster-packs', 'Blister', 43.90, 24, 'Português',
  'Blister com 4 Booster Packs da expansão Scarlet & Violet — Equilíbrio Perfeito em português.',
  '{"Edição":"Scarlet & Violet — Equilíbrio Perfeito","Conteúdo":"4 Booster Packs","Idioma":"Português","Formato":"Blister"}',
  true
),
(
  'Box Treinador Avançado — Equilíbrio Perfeito',
  'Equilíbrio Perfeito', 'etbs', 'ETB', 299.90, 8, 'Português',
  'Box Treinador Avançado (Elite Trainer Box) da expansão Scarlet & Violet — Equilíbrio Perfeito em português. Inclui Booster Packs, sleeves, dados e acessórios.',
  '{"Edição":"Scarlet & Violet — Equilíbrio Perfeito","Conteúdo":"9 Booster Packs + acessórios","Idioma":"Português","Formato":"Elite Trainer Box"}',
  true
),

-- Português — Herois Excelsos
(
  'Blister Triplo — Herois Excelsos',
  'Herois Excelsos', 'booster-packs', 'Blister', 43.90, 36, 'Português',
  'Blister com 3 Booster Packs da expansão Herois Excelsos em português.',
  '{"Edição":"Herois Excelsos","Conteúdo":"3 Booster Packs","Idioma":"Português","Formato":"Blister"}',
  true
),

-- Português — Evoluções Prismáticas
(
  'Blister Triplo — Evoluções Prismáticas',
  'Evoluções Prismáticas', 'booster-packs', 'Blister', 49.90, 12, 'Português',
  'Blister com 3 Booster Packs da expansão Evoluções Prismáticas em português.',
  '{"Edição":"Evoluções Prismáticas","Conteúdo":"3 Booster Packs","Idioma":"Português","Formato":"Blister"}',
  true
),

-- Português — Mega Evolução
(
  'Box Mega Venossauro EX — Mega Evolução',
  'Mega Evolução', 'boxes', 'Box', 135.90, 6, 'Português',
  'Box colecionável do Mega Venossauro EX da expansão XY — Mega Evolução em português. Inclui carta promo e Booster Packs.',
  '{"Edição":"XY — Mega Evolução","Idioma":"Português","Formato":"Box colecionável"}',
  true
),

-- Português — Fogo Fantasmagórico
(
  'Box Treinador Avançado — Fogo Fantasmagórico',
  'Fogo Fantasmagórico', 'etbs', 'ETB', 399.90, 8, 'Português',
  'Box Treinador Avançado (Elite Trainer Box) da expansão Fogo Fantasmagórico em português. Inclui Booster Packs, sleeves, dados e acessórios.',
  '{"Edição":"Fogo Fantasmagórico","Conteúdo":"9 Booster Packs + acessórios","Idioma":"Português","Formato":"Elite Trainer Box"}',
  true
),
(
  'Pokemon Box 36 Booster — Fogo Fantasmagórico',
  'Fogo Fantasmagórico', 'boxes', 'Box', 429.90, 8, 'Português',
  'Box com 36 Booster Packs da expansão Fogo Fantasmagórico em português. Ideal para colecionadores que buscam volume e variedade de pulls.',
  '{"Edição":"Fogo Fantasmagórico","Conteúdo":"36 Booster Packs","Idioma":"Português","Formato":"Box lacrada"}',
  true
),

-- Português — Parceiros Iniciais
(
  'Box Parceiros Iniciais — Parceiros Iniciais',
  'Parceiros Iniciais', 'boxes', 'Box', 239.90, 2, 'Português',
  'Box Parceiros Iniciais da expansão em português. Inclui cartas e conteúdo temático dos Pokémon iniciais.',
  '{"Edição":"Parceiros Iniciais","Idioma":"Português","Formato":"Box colecionável"}',
  true
),

-- Inglês — Mega Evolution
(
  'Booster Bundle — Mega Evolution',
  'Mega Evolution', 'boxes', 'Bundle', 219.90, 23, 'Inglês',
  'Booster Bundle com 6 Booster Packs da expansão Mega Evolution em inglês. Ótimo custo-benefício para quem quer abrir packs e aumentar a coleção.',
  '{"Edição":"Mega Evolution","Conteúdo":"6 Booster Packs","Idioma":"Inglês","Formato":"Bundle lacrado"}',
  true
);
