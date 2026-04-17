-- ============================================================
-- SK TCG — Seed de Produtos
-- Execute no SQL Editor do Supabase APÓS o supabase_schema.sql
-- ============================================================

insert into public.products (name, edition, category, ptype, price, badge, stock, description, img_url, specs, active)
values

-- ETB Ascended Heroes
(
  'ETB — Ascended Heroes',
  'Ascended Heroes',
  'boxes',
  'etb',
  409.49,
  'new',
  'in',
  'Elite Trainer Box da expansão Mega Evolution — Ascended Heroes. Inclui 9 Booster Packs, promo full art de N''s Zekrom, 65 sleeves exclusivas, 45 Energy cards, dados de dano, moeda plástica e caixa decorativa.',
  'https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me2pt5-elite-trainer-box/me2pt5-elite-trainer-box-169-en.png',
  '{"Edição":"Mega Evolution — Ascended Heroes","Conteúdo":"9 Booster Packs + acessórios","Promo":"N''s Zekrom Full Art","Sleeves":"65 un. — design Mega Dragonite ex","Idioma":"Inglês","Lançamento":"Fev 2026"}',
  true
),

-- Mini Tin Ascended Heroes
(
  'Mini Tin — Ascended Heroes',
  'Ascended Heroes',
  'accessories',
  'pack',
  81.89,
  'new',
  'in',
  'Mini Tin colecionável da expansão Mega Evolution — Ascended Heroes. Inclui 2 Booster Packs e uma moeda metálica exclusiva. Coleção completa combina as artes das 5 latas.',
  'https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me2pt5-mini-tins/me2pt5-mini-tins-169.png',
  '{"Edição":"Mega Evolution — Ascended Heroes","Conteúdo":"2 Booster Packs + moeda metálica","Idioma":"Inglês","Formato":"Lata colecionável","Lançamento":"Fev 2026"}',
  true
),

-- Booster Bundle Ascended Heroes
(
  'Booster Bundle — Ascended Heroes',
  'Ascended Heroes',
  'boxes',
  'pack',
  209.99,
  null,
  'in',
  'Booster Bundle com 6 Booster Packs da expansão Mega Evolution — Ascended Heroes. Melhor custo-benefício para maximizar pulls raros e acelerar a coleção.',
  'https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me2pt5-booster-bundle/me2pt5-booster-bundle-169-en.png',
  '{"Edição":"Mega Evolution — Ascended Heroes","Conteúdo":"6 Booster Packs","Idioma":"Inglês","Formato":"Bundle lacrado","Lançamento":"Fev 2026"}',
  true
),

-- 3-Pack Blister Perfect Order
(
  '3-Pack Blister — Perfect Order',
  'Perfect Order',
  'booster-packs',
  'pack',
  104.99,
  null,
  'in',
  'Blister com 3 Booster Packs da expansão Mega Evolution — Perfect Order. Inclui promo foil Chikorita e moeda metálica colecionável. Mega Zygarde ex lidera a expansão baseada em Pokémon Legends: Z-A.',
  'https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/me_series/me03/me03-booster-packs-169-en.png',
  '{"Edição":"Mega Evolution — Perfect Order","Conteúdo":"3 Booster Packs + promo + moeda","Promo":"Chikorita foil (MEP069)","Idioma":"Inglês","Lançamento":"Mar 2026"}',
  true
),

-- ETB Perfect Order
(
  'ETB — Perfect Order',
  'Perfect Order',
  'boxes',
  'etb',
  409.49,
  null,
  'in',
  'Elite Trainer Box da expansão Mega Evolution — Perfect Order. Contém 9 Booster Packs, promo Tyrunt Full Art, 65 sleeves temáticas, 45 Energy cards, dados de dano, moeda plástica e caixa decorativa.',
  'https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/incrementals/2026/me03-elite-trainer-box/me03-elite-trainer-box-169-en.png',
  '{"Edição":"Mega Evolution — Perfect Order","Conteúdo":"9 Booster Packs + acessórios","Promo":"Tyrunt Full Art","Mascote":"Mega Zygarde ex","Sleeves":"65 un. — design exclusivo","Idioma":"Inglês","Lançamento":"Mar 2026"}',
  true
);
