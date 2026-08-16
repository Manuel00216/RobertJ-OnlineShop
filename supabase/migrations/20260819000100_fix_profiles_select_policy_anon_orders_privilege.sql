-- =============================================================================
-- Fix: the combined anon+authenticated SELECT policy from
-- 20260819000000_scope_public_profile_visibility.sql referenced public.orders
-- in an EXISTS subquery. Postgres requires SELECT privilege on every table
-- referenced by a policy expression just to plan the query, regardless of
-- whether that branch is reachable at runtime for a given role — and anon
-- has no grant on public.orders (by design, orders are private, see
-- information_schema.role_table_grants). Result: every anon SELECT on
-- profiles — i.e. the entire logged-out storefront — started failing with
-- "permission denied for table orders" immediately after that migration.
--
-- Fix: split into two role-scoped policies so the anon-facing one never
-- references orders at all. `authenticated` already holds a table-level
-- SELECT grant on orders (RLS-restricted per row), so its policy keeps the
-- full seller/admin/own-row/order-relationship logic unchanged.
--
-- Applied directly to the live project (hjxtbnmnwlbqgptgncoh) immediately
-- after discovering the regression; this migration file exists to keep the
-- repo's migration history honest about what's actually live, per this
-- repo's Migration Policy (never edit an already-applied migration).
-- =============================================================================

begin;

drop policy if exists "profiles are publicly readable" on public.profiles;

create policy "profiles publicly readable by anon"
  on public.profiles for select
  to anon
  using (role in ('seller', 'admin'));

create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (
    role in ('seller', 'admin')
    or id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.orders o
      where o.buyer_id = profiles.id
        and o.seller_id = (select auth.uid())
    )
  );

commit;
