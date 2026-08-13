-- =============================================================================
-- Products shop scoping (Phase 3): adds `products.shop_id` and makes shop
-- membership (via `is_shop_member`, Phase 2) an additional, additive
-- authorization path alongside the existing `seller_id`-based RLS.
--
-- Scope, deliberately narrow:
--  * `seller_id` is NOT removed, renamed, or reinterpreted. Checkout, cart,
--    `create_order`, and order-line snapshots keep using it exactly as today.
--  * `shop_id` is nullable — one existing product (owned by a seller Phase 2
--    demoted to buyer) has no resolvable shop and is deliberately left NULL
--    rather than guessed at. It stays admin-manageable (`is_admin()` bypass)
--    and still publicly purchasable (the anon SELECT policy is unrelated to
--    `shop_id`) — a later admin action assigns it a shop explicitly.
--  * Every policy change below is additive: an `OR`-widening of `USING`, or a
--    `WITH CHECK`-only tightening that solely closes "reassign to a shop I'm
--    not a member of" — no existing legitimate access is narrowed.
--  * `orders`, `payments`, `shops`, `shop_users`, their RLS, and all 3
--    payment/order RPCs are untouched by this migration.
--
-- ROLLBACK:
--   drop policy "sellers insert their own products" on public.products;
--   create policy "sellers insert their own products" on public.products
--     for insert to authenticated
--     with check (seller_id = (select auth.uid()) and public.current_user_role() in ('seller','admin'));
--   -- (similarly restore the original select/update/delete policies from
--   -- 20260802000100_initial_schema.sql, then:)
--   alter table public.products drop column shop_id;
-- =============================================================================

begin;

alter table public.products
  add column shop_id uuid references public.shops (id);

create index products_shop_id_idx on public.products (shop_id);

-- Idempotent backfill: only fills NULLs, only for products whose seller has
-- a resolvable shop via shop_users. Safe to re-run.
update public.products p
set shop_id = su.shop_id
from public.shop_users su
where su.user_id = p.seller_id
  and p.shop_id is null;

-- ----------------------------------------------------------------------------
-- SELECT: widen to also grant shop members (redundant with seller_id today —
-- 1 shop : 1 member — but this is what makes multi-staff-per-shop work later
-- with zero further RLS changes).
-- ----------------------------------------------------------------------------
drop policy if exists "buyers read active products, sellers read their own" on public.products;
create policy "buyers read active products, sellers read their own"
  on public.products for select
  to authenticated
  using (
    status = 'active'
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- INSERT: seller_id requirement unchanged; NEW — validate shop_id membership,
-- closing a real gap (today's policy never examines shop_id at all).
-- ----------------------------------------------------------------------------
drop policy if exists "sellers insert their own products" on public.products;
create policy "sellers insert their own products"
  on public.products for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and public.current_user_role() in ('seller', 'admin')
    and (shop_id is null or public.is_shop_member(shop_id) or public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- UPDATE: widen USING (who can touch the row) and WITH CHECK (what the row
-- may become) identically — the WITH CHECK side prevents a seller reassigning
-- a product to a shop they don't belong to, the same immutability shape the
-- existing seller_id check already provides for reassigning ownership.
-- ----------------------------------------------------------------------------
drop policy if exists "sellers update their own products" on public.products;
create policy "sellers update their own products"
  on public.products for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  )
  with check (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- DELETE (archive): widen to also grant shop members.
-- ----------------------------------------------------------------------------
drop policy if exists "sellers delete their own products" on public.products;
create policy "sellers delete their own products"
  on public.products for delete
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

commit;
