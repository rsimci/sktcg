-- ============================================================
-- SK TCG — Trigger de estoque (stock_qty) vinculado a orders.status
-- ============================================================
-- Regra de negócio:
--   • Quando um pedido entra/transita para 'approved' → decrementa stock_qty
--     dos produtos conforme order_items.qty
--   • Quando sai de 'approved' para 'cancelled' ou 'refunded' → devolve
--     o estoque (compensa a reserva)
--   • Passagens entre outros estados (pending → cancelled direto, ou
--     approved → shipped → delivered) NÃO movem estoque de novo.
--
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- ---------- 1) Função que ajusta estoque com base em order_items ----------
create or replace function public.adjust_stock_for_order(p_order_id uuid, p_direction int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- p_direction = -1 (remove estoque) ou +1 (devolve estoque)
  update public.products pr
     set stock_qty = greatest(0, coalesce(pr.stock_qty, 0) + (p_direction * oi.qty))
    from public.order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = pr.id;
end;
$$;

-- ---------- 2) Trigger function nos updates de orders ----------
create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só reage a mudanças reais de status
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    -- Entrou em approved → decrementa
    if new.status = 'approved' and old.status <> 'approved' then
      perform public.adjust_stock_for_order(new.id, -1);
    end if;
    -- Saiu de approved para cancelled/refunded → devolve
    if old.status = 'approved' and new.status in ('cancelled','refunded') then
      perform public.adjust_stock_for_order(new.id, +1);
    end if;
  end if;
  return new;
end;
$$;

-- ---------- 3) Cria trigger (idempotente) ----------
drop trigger if exists orders_stock_sync on public.orders;

create trigger orders_stock_sync
  after update on public.orders
  for each row execute procedure public.handle_order_status_change();

-- ---------- 4) (Opcional) caso um pedido seja criado já com status 'approved' ----------
-- Raro (pagamento instantâneo registrado direto), mas suportamos:
create or replace function public.handle_order_insert_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    perform public.adjust_stock_for_order(new.id, -1);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stock_sync_insert on public.orders;

create trigger orders_stock_sync_insert
  after insert on public.orders
  for each row execute procedure public.handle_order_insert_approved();

-- ============================================================
-- VALIDAÇÃO
-- ============================================================
-- Depois de executar, teste:
--   1) Crie um pedido de teste com status 'pending' → estoque NÃO deve mudar
--   2) Update status para 'approved' → estoque dos produtos do pedido deve diminuir
--   3) Update status para 'refunded' → estoque deve voltar
-- ============================================================
