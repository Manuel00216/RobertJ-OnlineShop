-- =============================================================================
-- get_product_sold_counts(uuid[]): a public, read-only aggregate of paid
-- units sold per product, for the product card's "N sold" badge. Mirrors the
-- same "read-only SECURITY DEFINER RPC over existing tables" shape as
-- get_buyer_activity_feed (20260823000000) and the report_* RPCs
-- (20260818000000) — no new table, no triggers. order_items has no
-- public-read RLS policy (it follows its parent order), so this exposes only
-- the aggregate, never buyer/order identity.
--
-- "Sold" = order_items belonging to orders with payment_status = 'paid' —
-- the same definition report_top_products already uses for its revenue
-- figure, so this public number agrees with the seller's own Reports.
--
-- Unlike get_buyer_activity_feed, this one is meant for anon: it backs a
-- catalog-wide badge visible to signed-out shoppers too.
--
-- ROLLBACK:
--   drop function public.get_product_sold_counts(uuid[]);
-- =============================================================================

begin;

create or replace function public.get_product_sold_counts(p_product_ids uuid[])
returns table (
  product_id uuid,
  units_sold bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select oi.product_id, sum(oi.quantity)::bigint as units_sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = any(p_product_ids)
    and o.payment_status = 'paid'
  group by oi.product_id;
$$;

revoke all on function public.get_product_sold_counts(uuid[])
  from public;

grant execute on function public.get_product_sold_counts(uuid[])
  to anon, authenticated;

commit;
