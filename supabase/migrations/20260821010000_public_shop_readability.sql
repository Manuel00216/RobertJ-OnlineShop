-- =============================================================================
-- Public shop readability (Buyer UX Improvement Phase — see DECISIONS.md
-- ADR-018): buyers and guests need to read real shop names for "Sold by
-- [Shop]", the shop filter, and Featured Shops. None of that was possible
-- before this migration — `shops` SELECT was member/admin-only
-- (`is_shop_member(id) OR is_admin()`, see 20260813000000), and `anon` had
-- no grant on the table at all.
--
-- Mirrors the existing `products` convention exactly: a plain
-- `active = true` policy for `anon`, and a matching widening for
-- `authenticated` (which already had a member/admin policy — Postgres RLS
-- policies of the same command are OR'd together, so this only *adds*
-- visibility, it never removes the existing member/admin case, e.g. an
-- owner viewing their own deactivated shop).
--
-- Additive only: no existing policy, grant, or the admin-only INSERT/UPDATE
-- policies are touched. Inactive shops remain invisible to anon/authenticated.
--
-- ROLLBACK:
--   drop policy "active shops are publicly readable" on public.shops;
--   drop policy "authenticated users read active shops" on public.shops;
--   revoke select on public.shops from anon;
-- =============================================================================

begin;

create policy "active shops are publicly readable"
  on public.shops for select
  to anon
  using (active = true);

create policy "authenticated users read active shops"
  on public.shops for select
  to authenticated
  using (active = true);

grant select on public.shops to anon;

commit;
