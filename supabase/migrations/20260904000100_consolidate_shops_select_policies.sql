-- =============================================================================
-- Consolidate the two `authenticated` SELECT policies on public.shops into one
-- (Performance hardening — audit finding F-D4; Supabase advisor 0006
-- "Multiple Permissive Policies").
--
-- History: 20260813000000 created "shop members and admins read the shop"
-- (is_shop_member(id) OR is_admin()); 20260821010000 later added
-- "authenticated users read active shops" (active = true) to widen buyer
-- visibility. Postgres OR's permissive policies of the same command, so an
-- authenticated user currently sees a shop when:
--     active = true  OR  is_shop_member(id)  OR  is_admin()
-- but every such SELECT pays to evaluate BOTH policies.
--
-- This merges them into a single policy whose USING clause is the exact OR of
-- the two predicates — identical visibility, one policy evaluated instead of
-- two. In particular a shop owner/admin can still read their own *inactive*
-- shop (the is_shop_member/is_admin branch is preserved).
--
-- The `anon` policy "active shops are publicly readable" (active = true) is
-- deliberately NOT touched — anon has a single SELECT policy, so it isn't part
-- of the advisor finding, and guests must keep seeing active shops.
--
-- SAFE / NON-BREAKING: net row visibility for `authenticated` is unchanged;
-- no grant, INSERT/UPDATE policy, or data is modified. Wrapped in a
-- transaction so the drop+create is atomic (no window with zero SELECT policy).
--
-- ROLLBACK:
--   drop policy if exists "authenticated users read shops" on public.shops;
--   create policy "shop members and admins read the shop"
--     on public.shops for select to authenticated
--     using (public.is_shop_member(id) or public.is_admin());
--   create policy "authenticated users read active shops"
--     on public.shops for select to authenticated
--     using (active = true);
-- =============================================================================

begin;

drop policy if exists "authenticated users read active shops" on public.shops;
drop policy if exists "shop members and admins read the shop" on public.shops;

create policy "authenticated users read shops"
  on public.shops for select
  to authenticated
  using (
    active = true
    or public.is_shop_member(id)
    or public.is_admin()
  );

commit;
