-- =============================================================================
-- Wishlist (Buyer UX Improvement Phase — see DECISIONS.md ADR-018): the first
-- plain-RLS, non-RPC-gated user-owned table in this schema. Every other
-- user-owned write in this database goes through a SECURITY DEFINER RPC
-- (submit_qr_payment, adjust_stock, admin_assign_seller_shop) because those
-- writes protect a cross-entity invariant (stock, money, role). A wishlist
-- row has none of that: it is a pure `(user_id, product_id)` toggle owned
-- entirely by its own row's `user_id`, so a `user_id = auth.uid()` RLS policy
-- gives exactly the same guarantee an RPC would, with far less code.
--
-- Authenticated-only by design: a guest has no `profiles` row for
-- `user_id` to reference, so there is nothing to grant `anon` here — the
-- buyer-facing UI prompts sign-in before ever calling this table.
--
-- ROLLBACK:
--   drop table public.wishlists;
-- =============================================================================

begin;

create table public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint wishlists_unique_item unique (user_id, product_id)
);

create index wishlists_user_id_idx on public.wishlists (user_id);

comment on table public.wishlists is
  'Buyer-saved products. Plain RLS-scoped to auth.uid(), no RPC — see DECISIONS.md ADR-018 for why this table deliberately deviates from the RPC-gated write pattern used elsewhere.';

-- ----------------------------------------------------------------------------
-- RLS: a user manages only their own wishlist rows. No admin/seller override
-- — a wishlist is private to its owner, unlike orders/products, which staff
-- legitimately need to see.
-- ----------------------------------------------------------------------------
alter table public.wishlists enable row level security;

create policy "users read their own wishlist"
  on public.wishlists for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users add to their own wishlist"
  on public.wishlists for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users remove from their own wishlist"
  on public.wishlists for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE policy: a wishlist row is a pure toggle — remove + re-add instead
-- of updating in place, matching shop_users' "immutable row" precedent.

revoke all on public.wishlists from anon, authenticated;
grant select, insert, delete on public.wishlists to authenticated;

commit;
