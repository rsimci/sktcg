-- ============================================================
-- SK TCG — Schema Supabase
-- Execute no SQL Editor do Supabase (projeto > SQL Editor > New query)
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- Dados extras do usuário (além do que o Supabase Auth já guarda)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  cpf         text,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABELA: addresses
-- Endereços do cliente
-- ============================================================
create table if not exists public.addresses (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  label         text default 'Principal',
  cep           text,
  street        text,
  number        text,
  complement    text,
  neighborhood  text,
  city          text,
  state         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- TABELA: editions
-- Edições/expansões do Pokémon TCG
-- ============================================================
create table if not exists public.editions (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text,
  year        text,
  color       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABELA: products
-- Catálogo de produtos
-- ============================================================
create table if not exists public.products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  edition     text,
  category    text,   -- 'booster-packs' | 'boxes' | 'singles' | 'graded' | 'accessories'
  ptype       text,   -- 'pack' | 'etb' | 'mini' | 'card' | 'accessory'
  price       numeric(10,2) not null,
  old_price   numeric(10,2),
  badge       text,   -- 'new' | 'sale' | 'hot' | 'graded'
  stock       text default 'in',  -- 'in' | 'low' | 'out'
  description text,
  img_url     text,
  specs       jsonb,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABELA: cart_items
-- Carrinho persistente por usuário
-- ============================================================
create table if not exists public.cart_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete cascade,
  qty         integer not null default 1,
  created_at  timestamptz default now(),
  unique (user_id, product_id)
);

-- ============================================================
-- TABELA: orders
-- Pedidos realizados
-- ============================================================
create table if not exists public.orders (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id),
  status              text default 'pending',
  -- 'pending' | 'approved' | 'cancelled' | 'refunded' | 'shipped' | 'delivered'
  mp_preference_id    text,   -- ID da preferência Mercado Pago
  mp_payment_id       text,   -- ID do pagamento após confirmação
  mp_payment_status   text,
  subtotal            numeric(10,2),
  shipping_cost       numeric(10,2) default 0,
  total               numeric(10,2),
  shipping_address    jsonb,  -- snapshot do endereço no momento do pedido
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================
-- TABELA: order_items
-- Itens de cada pedido (snapshot de preço no momento da compra)
-- ============================================================
create table if not exists public.order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id),
  name        text,       -- snapshot do nome
  price       numeric(10,2),  -- snapshot do preço
  qty         integer not null,
  img_url     text
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuário só acessa seus próprios dados
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.addresses    enable row level security;
alter table public.cart_items   enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- Produtos e edições são públicos (leitura)
alter table public.products     enable row level security;
alter table public.editions     enable row level security;

-- Policies: profiles
create policy "Usuário lê próprio perfil"
  on public.profiles for select using (auth.uid() = id);
create policy "Usuário atualiza próprio perfil"
  on public.profiles for update using (auth.uid() = id);
create policy "Inserção automática de perfil"
  on public.profiles for insert with check (auth.uid() = id);

-- Policies: addresses
create policy "Usuário gerencia próprios endereços"
  on public.addresses for all using (auth.uid() = user_id);

-- Policies: cart_items
create policy "Usuário gerencia próprio carrinho"
  on public.cart_items for all using (auth.uid() = user_id);

-- Policies: orders
create policy "Usuário lê próprios pedidos"
  on public.orders for select using (auth.uid() = user_id);

-- Policies: order_items
create policy "Usuário lê itens de seus pedidos"
  on public.order_items for select
  using (exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  ));

-- Policies: products e editions — leitura pública
create policy "Produtos visíveis para todos"
  on public.products for select using (active = true);
create policy "Edições visíveis para todos"
  on public.editions for select using (true);

-- ============================================================
-- TRIGGER: criar profile automaticamente ao registrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: atualizar updated_at em orders
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();
