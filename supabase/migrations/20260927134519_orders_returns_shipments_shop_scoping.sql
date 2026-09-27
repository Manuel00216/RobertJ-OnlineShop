-- =============================================================================
-- Orders/Returns/Shipments shop scoping — additive shop_id bridge so a
-- reassigned shop manager (new seller) inherits access to the shop's
-- historical orders/payments/returns/shipments without rewriting any
-- historical seller_id. Mirrors 20260814000000_products_shop_scoping.sql's
-- pattern exactly: nullable shop_id, idempotent backfill, seller_id
-- untouched. See ARCHITECTURE.md TD-1 ("orders/payments/returns leg still
-- open").
--
-- payments has NO shop_id column added — it inherits shop scoping via its
-- existing orders join (same pattern it already uses for seller_id).
-- =============================================================================

begin;

alter table public.orders
  add column if not exists shop_id uuid references public.shops (id);

alter table public.return_requests
  add column if not exists shop_id uuid references public.shops (id);

alter table public.order_shipments
  add column if not exists shop_id uuid references public.shops (id);

create index if not exists orders_shop_id_idx on public.orders (shop_id);
create index if not exists return_requests_shop_id_idx on public.return_requests (shop_id);
create index if not exists order_shipments_shop_id_idx on public.order_shipments (shop_id);

-- Idempotent backfill: only fills NULLs. Orders backfill from the seller's
-- CURRENT shop_users membership (best-effort historical bridge — a seller
-- with no shop membership today, e.g. already demoted, is left NULL rather
-- than guessed at, same posture as products.shop_id's original backfill).
update public.orders o
set shop_id = su.shop_id
from public.shop_users su
where su.user_id = o.seller_id
  and o.shop_id is null;

update public.return_requests r
set shop_id = o.shop_id
from public.orders o
where o.id = r.order_id
  and r.shop_id is null
  and o.shop_id is not null;

update public.order_shipments os
set shop_id = o.shop_id
from public.orders o
where o.id = os.order_id
  and os.shop_id is null
  and o.shop_id is not null;

-- Auto-populate order_shipments.shop_id from the parent order for any write
-- path that doesn't explicitly set it (e.g. markOrderPacked's plain upsert)
-- — mirrors sync_inventory_shop_id's existing denormalization-trigger shape
-- (20260815000000_inventory_and_stock_history.sql), but BEFORE INSERT since
-- there is no prior row to sync from.
create or replace function public.set_order_shipment_shop_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shop_id is null then
    select shop_id into new.shop_id from public.orders where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_shipments_set_shop_id on public.order_shipments;
create trigger order_shipments_set_shop_id
  before insert on public.order_shipments
  for each row execute function public.set_order_shipment_shop_id();

commit;
