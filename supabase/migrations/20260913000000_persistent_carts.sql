-- =============================================================================
-- Persistent authenticated cart (Phase 2A — schema + RLS only).
--
-- Context: the cart has always been client-side (DECISIONS.md ADR-013),
-- explicitly noting a future revisit "if cross-device cart persistence
-- becomes a requirement... add a server-synced cart for authenticated users
-- only, without changing the guest experience." This migration is that
-- revisit. Guest carts are entirely unaffected — they keep living in
-- localStorage (`roberj.cart.v1:guest`); nothing here changes that.
--
-- Two new, additive tables only:
--   carts       — one row per authenticated user (`carts_one_per_user`).
--   cart_items  — that user's lines: product_id + optional variant_id +
--                 quantity. No price/title snapshot columns — unlike
--                 order_items, a cart is not a historical record; price and
--                 stock are always re-validated live via the existing
--                 getProductsPriceAndStock/getVariantsPriceAndStock/
--                 checkCartAvailability (Phase 3c), same as today's client
--                 cart already does before checkout.
--
-- Conventions reused verbatim from addresses.sql / wishlists.sql:
--   - Plain RLS, no RPC: a cart row has no cross-entity invariant (stock,
--     money, role) to protect, just per-row ownership — same reasoning as
--     both of those tables.
--   - No admin/seller override: a cart is private to its owner, like an
--     address book or wishlist, unlike orders/products which staff
--     legitimately need to see. A seller owning a product inside someone's
--     cart gains no visibility into that cart.
--   - `user_id = auth.uid()` is the sole authorization boundary.
--
-- Conventions reused from inventory.sql / product_variants.sql:
--   - Partial unique indexes split the "one line per non-variant product"
--     invariant from "one line per variant" — a plain `unique(cart_id,
--     product_id)` would incorrectly collapse every variant line of the
--     same product into one row, since NULL <> NULL for uniqueness purposes
--     only works in the *other* direction (multiple NULLs are already
--     distinct) — the split is what makes both invariants hold at once.
--
-- New here: `cart_items_validate_variant` — a plain BEFORE INSERT/UPDATE
-- trigger (SECURITY INVOKER, not a SECURITY DEFINER function, not an RPC)
-- checking that a line's variant_id actually belongs to its product_id.
-- Postgres CHECK constraints can't reference another table, so this is the
-- standard way to enforce cross-table consistency — same category of
-- trigger as `addresses_enforce_single_default` or `seed_inventory_for_
-- variant`, not a new architectural pattern. It runs as the calling user;
-- that's sufficient because `product_variants` is already readable to any
-- authenticated buyer for exactly the rows that matter here (active
-- variants of active products), per that table's own RLS policy.
--
-- Deliberately NOT done in this migration (Phase 2A is schema + RLS only):
--   - No queries.ts / Server Actions / CartProvider / UI changes.
--   - No migration of existing localStorage carts into these tables.
--   - No guest-cart merge-on-login logic.
--
-- ROLLBACK:
--   drop table public.cart_items;
--   drop table public.carts;
--   drop function public.cart_items_validate_variant();
-- =============================================================================

begin;

create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint carts_one_per_user unique (user_id)
);

comment on table public.carts is
  'One persistent cart per authenticated user (Phase 2A). Guest carts stay in localStorage — see this migration''s header. No admin/seller override, same as addresses/wishlists.';

create index carts_user_id_idx on public.carts (user_id);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  variant_id  uuid references public.product_variants (id) on delete cascade,
  quantity    integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cart_items_quantity_positive check (quantity > 0)
);

comment on table public.cart_items is
  'Lines in a persistent cart. No price/title snapshot — always re-validated live (see this migration''s header). variant_id, when set, is checked by cart_items_validate_variant to belong to product_id.';

comment on column public.cart_items.variant_id is
  'Null for a plain product line. When set, must reference a variant of the same product_id — enforced by the cart_items_validate_variant trigger, not a CHECK constraint (Postgres CHECK can''t reference another table).';

-- ON DELETE CASCADE here (not RESTRICT, unlike order_items.variant_id): a
-- cart line for a since-deleted product/variant is clutter, not a
-- historical record worth protecting.

-- Mirrors inventory/order_items' split-invariant pattern exactly.
create unique index cart_items_unique_no_variant
  on public.cart_items (cart_id, product_id) where variant_id is null;
create unique index cart_items_unique_variant
  on public.cart_items (cart_id, product_id, variant_id) where variant_id is not null;

create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index cart_items_product_id_idx on public.cart_items (product_id);
create index cart_items_variant_id_idx on public.cart_items (variant_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cross-table integrity: a cart line's variant must belong to its product.
-- Plain trigger, SECURITY INVOKER (the default — stated explicitly to match
-- this codebase's convention of never leaving it implicit) — not an RPC, not
-- SECURITY DEFINER. Runs as the calling (authenticated) user; product_variants
-- is already readable to them for every row this check needs to see.
-- -----------------------------------------------------------------------------
create or replace function public.cart_items_validate_variant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.variant_id is not null then
    if not exists (
      select 1
      from public.product_variants v
      where v.id = new.variant_id
        and v.product_id = new.product_id
    ) then
      raise exception 'Variant % does not belong to product %', new.variant_id, new.product_id
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.cart_items_validate_variant is
  'BEFORE INSERT/UPDATE trigger on cart_items: rejects a line whose variant_id does not belong to its product_id. Plain SECURITY INVOKER trigger, not an RPC or SECURITY DEFINER function.';

create trigger cart_items_validate_variant
  before insert or update of product_id, variant_id on public.cart_items
  for each row execute function public.cart_items_validate_variant();

-- -----------------------------------------------------------------------------
-- RLS — plain ownership, no admin/seller override (see header).
-- -----------------------------------------------------------------------------
alter table public.carts enable row level security;

create policy "users read their own cart"
  on public.carts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users create their own cart"
  on public.carts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users delete their own cart"
  on public.carts for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE policy: a carts row is just an anchor (id/user_id/timestamps);
-- nothing about it is ever mutated in place after creation.

revoke all on public.carts from anon, authenticated;
grant select, insert, delete on public.carts to authenticated;

alter table public.cart_items enable row level security;

create policy "users read their own cart items"
  on public.cart_items for select
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

create policy "users insert their own cart items"
  on public.cart_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

create policy "users update their own cart items"
  on public.cart_items for update
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

create policy "users delete their own cart items"
  on public.cart_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

revoke all on public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

commit;
