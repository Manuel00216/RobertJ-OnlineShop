-- =============================================================================
-- resolve_shop_membership() (Buyer UX Improvement Phase — see DECISIONS.md
-- ADR-018): the bridge buyer-facing reads need between `products.seller_id`
-- and real shop identity, now that `products.shop_id` is unpopulated on every
-- live row (TD-1 is still open) and `shop_users` — the only table that
-- actually holds the seller→shop mapping today — is member/admin-only RLS
-- (`user_id = auth.uid() OR is_admin()`, see 20260813000000). A buyer/guest
-- has no grant to read arbitrary `shop_users` rows, so a plain embedded
-- `products -> profiles -> shop_users -> shops` select (even after the
-- previous migration made `shops` public) returns nothing for that hop.
--
-- Rather than widen `shop_users` RLS itself (which would expose the full
-- membership table, not just the narrow (seller_id, shop_id, shop_name)
-- lookup buyer surfaces need), this is one narrow, read-only
-- `SECURITY DEFINER` RPC — same chokepoint pattern as the `report_*`
-- functions — that exposes exactly three columns and nothing else from
-- either table (no shop_users.id/created_at, no shops.slug/active).
--
-- Two independent lookup directions via optional array params, so one
-- function covers every buyer-facing need instead of three near-duplicates:
--   * p_shop_ids   -> every seller belonging to those shops (shop filter,
--                     Featured Shops product counts)
--   * p_seller_ids -> the shop each of those sellers belongs to ("Sold by
--                     [Shop]" on the PDP, shop name on product cards)
-- Passing neither returns every active shop's membership (small dataset —
-- three shops today).
--
-- ROLLBACK:
--   drop function public.resolve_shop_membership(uuid[], uuid[]);
-- =============================================================================

begin;

create or replace function public.resolve_shop_membership(
  p_shop_ids uuid[] default null,
  p_seller_ids uuid[] default null
)
returns table (seller_id uuid, shop_id uuid, shop_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select su.user_id as seller_id, s.id as shop_id, s.name as shop_name
  from public.shop_users su
  join public.shops s on s.id = su.shop_id
  where s.active = true
    and (p_shop_ids is null or su.shop_id = any(p_shop_ids))
    and (p_seller_ids is null or su.user_id = any(p_seller_ids));
$$;

revoke all on function public.resolve_shop_membership(uuid[], uuid[]) from public;
grant execute on function public.resolve_shop_membership(uuid[], uuid[]) to anon, authenticated;

commit;
