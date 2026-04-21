-- ============================================================
-- SK TCG — Tabela de Favoritos (Wishlist)
-- Execute no SQL Editor do Supabase
-- ============================================================

create table public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, product_id)
);

alter table public.wishlist enable row level security;

create policy "Usuário gerencia própria wishlist" on public.wishlist
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
