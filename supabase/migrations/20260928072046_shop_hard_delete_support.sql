-- =============================================================================
-- Shop hard delete support — completing Shop CRUD with a safe, permanent
-- delete, following the exact pattern already shipped for seller hard delete
-- (20260928054321_seller_hard_delete_support.sql): loosen only the FKs that
-- don't hold irreplaceable history to `on delete set null`, add an
-- admin-only `SECURITY DEFINER` RPC that snapshots into the existing
-- `admin_action_log` before deleting, and leave a two-step contract (this RPC
-- does DB bookkeeping; the caller cleans up the `shop-images` Storage prefix
-- afterward, in the same operation).
--
-- Problem: 8 tables carry a `shop_id` FK to `shops(id)` with the implicit
-- default `on delete no action` (effectively RESTRICT): products,
-- product_variants, inventory, stock_adjustments, recommendation_rules,
-- orders, return_requests, order_shipments. `DELETE FROM shops` fails
-- (23503) the instant any dependent row exists — today, every shop that has
-- ever had a product.
--
-- Fix, deliberately narrow — only the 5 tables whose `shop_id` is a
-- detachable label with no history of its own get loosened. `orders`,
-- `return_requests`, `order_shipments`, and `shop_users` are NOT loosened:
-- the new RPC's own guard requires those to already be zero rows for the
-- target shop before it will proceed, so their FK stays a DB-level backstop
-- that can never fire in practice but costs nothing to keep. This is the
-- same asymmetry the seller migration applied to `profiles`' dependents.
--
-- RPC: admin_hard_delete_shop — mirrors admin_hard_delete_seller_account's
-- shape exactly (explicit is_admin() check, row lock, guard preconditions,
-- jsonb snapshot into admin_action_log, single transaction). Requires the
-- shop already deactivated (two-step precedent, same as accounts), requires
-- zero current shop_users members (an admin reassigns/removes them first via
-- the existing admin_assign_seller_shop/admin_demote_seller_to_buyer flows —
-- this RPC does not attempt to reproduce that logic as a side effect), and
-- requires zero historical rows across orders.shop_id, return_requests.shop_id,
-- order_shipments.shop_id, AND order_items joined through products.shop_id
-- (this last check exists because orders.shop_id is only reliably stamped
-- for orders placed after the shop-scoped continuity work landed — an older
-- order whose seller had since left the shop can have a real, delivered
-- order_item under a product that still carries this shop_id while
-- orders.shop_id itself is null; checking orders.shop_id alone would miss
-- it). Does NOT touch Storage — the caller must remove the
-- `shop-images/{shop_id}/` prefix immediately after in the same operation.
--
-- ROLLBACK:
--   revoke execute on function public.admin_hard_delete_shop(uuid, text) from authenticated;
--   drop function public.admin_hard_delete_shop(uuid, text);
--   alter table public.recommendation_rules drop constraint recommendation_rules_shop_id_fkey;
--   alter table public.recommendation_rules add constraint recommendation_rules_shop_id_fkey foreign key (shop_id) references public.shops (id);
--   alter table public.stock_adjustments drop constraint stock_adjustments_shop_id_fkey;
--   alter table public.stock_adjustments add constraint stock_adjustments_shop_id_fkey foreign key (shop_id) references public.shops (id);
--   alter table public.inventory drop constraint inventory_shop_id_fkey;
--   alter table public.inventory add constraint inventory_shop_id_fkey foreign key (shop_id) references public.shops (id);
--   alter table public.product_variants drop constraint product_variants_shop_id_fkey;
--   alter table public.product_variants add constraint product_variants_shop_id_fkey foreign key (shop_id) references public.shops (id);
--   alter table public.products drop constraint products_shop_id_fkey;
--   alter table public.products add constraint products_shop_id_fkey foreign key (shop_id) references public.shops (id);
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Loosen the 5 detachable-label FKs. All 5 columns are already nullable —
-- no data change, only the ON DELETE behavior changes.
-- -----------------------------------------------------------------------------
alter table public.products drop constraint products_shop_id_fkey;
alter table public.products
  add constraint products_shop_id_fkey
  foreign key (shop_id) references public.shops (id) on delete set null;

alter table public.product_variants drop constraint product_variants_shop_id_fkey;
alter table public.product_variants
  add constraint product_variants_shop_id_fkey
  foreign key (shop_id) references public.shops (id) on delete set null;

alter table public.inventory drop constraint inventory_shop_id_fkey;
alter table public.inventory
  add constraint inventory_shop_id_fkey
  foreign key (shop_id) references public.shops (id) on delete set null;

alter table public.stock_adjustments drop constraint stock_adjustments_shop_id_fkey;
alter table public.stock_adjustments
  add constraint stock_adjustments_shop_id_fkey
  foreign key (shop_id) references public.shops (id) on delete set null;

alter table public.recommendation_rules drop constraint recommendation_rules_shop_id_fkey;
alter table public.recommendation_rules
  add constraint recommendation_rules_shop_id_fkey
  foreign key (shop_id) references public.shops (id) on delete set null;


-- -----------------------------------------------------------------------------
-- RPC: admin_hard_delete_shop — sole permanent-delete path for a shop.
-- -----------------------------------------------------------------------------
create or replace function public.admin_hard_delete_shop(
  p_shop_id uuid,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := (select auth.uid());
  v_shop             public.shops;
  v_member_count     bigint;
  v_history_count    bigint;
  v_products_count   bigint;
  v_variants_count   bigint;
  v_inventory_count  bigint;
  v_stock_adj_count  bigint;
  v_reco_rules_count bigint;
  v_summary          jsonb;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to delete this shop'
      using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Shop not found' using errcode = 'P0002';
  end if;

  if v_shop.active then
    raise exception 'Deactivate this shop before permanently deleting it'
      using errcode = '22023';
  end if;

  if p_reason is not null and char_length(p_reason) > 200 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;

  select count(*) into v_member_count
  from public.shop_users
  where shop_id = p_shop_id;
  if v_member_count > 0 then
    raise exception 'This shop still has % assigned seller(s) — reassign or remove them first',
      v_member_count
      using errcode = '22023';
  end if;

  select count(*) into v_history_count
  from public.orders
  where shop_id = p_shop_id;
  if v_history_count = 0 then
    select count(*) into v_history_count
    from public.return_requests
    where shop_id = p_shop_id;
  end if;
  if v_history_count = 0 then
    select count(*) into v_history_count
    from public.order_shipments
    where shop_id = p_shop_id;
  end if;
  -- Catches real order history a product carries even when orders.shop_id
  -- itself is null (an order placed before the shop-scoped continuity
  -- backfill, whose seller has since left this shop) — see the migration
  -- header for why orders.shop_id alone is not a sufficient check.
  if v_history_count = 0 then
    select count(*) into v_history_count
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where p.shop_id = p_shop_id;
  end if;
  if v_history_count > 0 then
    raise exception 'This shop has historical orders and cannot be permanently deleted — deactivate it instead'
      using errcode = '22023';
  end if;

  select count(*) into v_products_count from public.products where shop_id = p_shop_id;
  select count(*) into v_variants_count from public.product_variants where shop_id = p_shop_id;
  select count(*) into v_inventory_count from public.inventory where shop_id = p_shop_id;
  select count(*) into v_stock_adj_count from public.stock_adjustments where shop_id = p_shop_id;
  select count(*) into v_reco_rules_count from public.recommendation_rules where shop_id = p_shop_id;

  v_summary := jsonb_build_object(
    'name', v_shop.name,
    'slug', v_shop.slug,
    'description', v_shop.description,
    'logo_url', v_shop.logo_url,
    'banner_url', v_shop.banner_url,
    'reason', p_reason,
    'detached_products_count', v_products_count,
    'detached_variants_count', v_variants_count,
    'detached_inventory_count', v_inventory_count,
    'detached_stock_adjustments_count', v_stock_adj_count,
    'detached_recommendation_rules_count', v_reco_rules_count
  );

  insert into public.admin_action_log (
    actor_id, action, target_shop_id, metadata
  )
  values (
    v_uid, 'hard_delete_shop', p_shop_id, v_summary
  );

  delete from public.shops where id = p_shop_id;

  return v_summary;
end;
$$;

comment on function public.admin_hard_delete_shop is
  'Admin-only permanent delete for an already-deactivated, member-free, history-free shop: snapshots identity + detached-row counts into admin_action_log, then deletes. Products/variants/inventory/stock_adjustments/recommendation_rules are preserved with shop_id set null via the loosened FKs — never deleted. Blocked with a friendly error if the shop has any member, order, return, shipment, or order_item history. Caller must remove the shop-images/{shop_id}/ Storage prefix immediately after — this function never touches Storage.';

revoke all on function public.admin_hard_delete_shop(uuid, text) from public, anon;
grant execute on function public.admin_hard_delete_shop(uuid, text) to authenticated;

commit;
