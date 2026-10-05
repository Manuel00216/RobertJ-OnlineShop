-- ============================================================================
-- Fix: the landing page's "live" marketplace stats (buyerCount,
-- fulfilledOrderCount) were read through the normal RLS-scoped session
-- client. `profiles` SELECT RLS only exposes role in ('seller','admin'),
-- the caller's own row, or an admin/seller-order relationship (see
-- 20260816150838_fix_profiles_select_policy_anon_orders_privilege.sql) — a
-- buyer-role row is invisible to anon and to every other buyer, so counting
-- `role = 'buyer'` that way silently returns 0 for virtually every visitor.
-- `orders` has no anon table grant at all (20260802164203_rls_hardening.sql),
-- so the fulfilled-order count errors outright for anon and falls back to
-- the hardcoded placeholder.
--
-- Aggregate, non-sensitive marketplace-wide counts need to be computed
-- server-side regardless of the viewer's row-level visibility — the same
-- reasoning behind this schema's other SECURITY DEFINER helpers
-- (current_user_role(), is_admin()). This function returns four counts and
-- nothing else; it exposes no row data, matching the privacy posture of the
-- seller/product counts already shown publicly today.
-- ============================================================================

begin;

create function public.get_marketplace_stats()
returns table (
  seller_count bigint,
  product_count bigint,
  buyer_count bigint,
  fulfilled_order_count bigint
)
language sql
stable
security definer
set search_path to ''
as $fn$
  select
    (select count(*) from public.profiles where role = 'seller') as seller_count,
    (select count(*) from public.products where status = 'active') as product_count,
    (select count(*) from public.profiles where role = 'buyer') as buyer_count,
    (select count(*) from public.orders where order_status = 'delivered') as fulfilled_order_count;
$fn$;

comment on function public.get_marketplace_stats() is
  'Aggregate, non-sensitive marketplace-wide counts for the public landing page. SECURITY DEFINER so the counts reflect the true platform totals regardless of the calling viewer''s RLS visibility on profiles/orders. Returns only counts, never row data.';

revoke all on function public.get_marketplace_stats() from public;
grant execute on function public.get_marketplace_stats() to anon, authenticated;

commit;
