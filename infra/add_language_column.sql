-- Migração: adiciona coluna language à tabela products
-- Execute no Supabase Dashboard → SQL Editor

alter table public.products
  add column if not exists language text; -- 'Português' | 'Inglês'

-- Atualizar produtos existentes (Inglês por padrão para os 5 atuais)
-- Ajuste conforme necessário antes de executar
update public.products
  set language = 'Inglês'
  where language is null;
