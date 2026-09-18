begin;

-- -----------------------------------------------------------------------------
-- Phase 3c (buyer variant flow) needs to show a variant's available stock on
-- the PDP and re-check it before checkout. `inventory` itself is NOT publicly
-- readable (shop members/admin only, see 20260815000000_inventory_and_stock_
-- history.sql) — the same way a buyer never reads `inventory` for a plain
-- product, only the public `products.quantity` mirror. That mirror is
-- intentionally frozen once a product has variants (sync_products_quantity_
-- from_inventory skips it for variant-level rows), so there is no existing
-- public path to a variant's quantity.
--
-- This adds exactly one SECURITY DEFINER, read-only RPC — same idiom as
-- get_my_profile() — that returns nothing but (variant_id, quantity) for
-- variants that are active and whose parent product is active: the identical
-- visibility envelope the `product_variants` SELECT RLS policy already grants
-- for anon/buyer reads of every other variant column. No new table, no
-- column, no write path, no change to adjust_stock/create_order.
--
-- Rollback:
--   drop function public.get_variant_stock(uuid[]);
-- -----------------------------------------------------------------------------

create or replace function public.get_variant_stock(p_variant_ids uuid[])
returns table (variant_id uuid, quantity integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.variant_id, i.quantity
  from public.inventory i
  join public.product_variants v on v.id = i.variant_id
  join public.products p on p.id = v.product_id
  where i.variant_id = any (p_variant_ids)
    and v.status = 'active'
    and p.status = 'active';
$$;

comment on function public.get_variant_stock(uuid[]) is
  'Public-safe variant stock lookup for the PDP and cart availability re-check — returns quantity only, scoped to active variants of active products (same envelope as the product_variants public SELECT policy). inventory itself stays non-public.';

revoke all on function public.get_variant_stock(uuid[]) from public;
grant execute on function public.get_variant_stock(uuid[]) to anon, authenticated;

commit;
