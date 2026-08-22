-- =============================================================================
-- Shops + Shop Users (Phase 2 foundation): introduces the SAD's target
-- `shops`/`shop_users` model alongside — not instead of — the existing
-- `seller_id` ownership on `products`/`orders`/`payments`.
--
-- Scope, deliberately narrow (see ARCHITECTURE.md TD-1):
--  * `products`, `orders`, `payments`, `create_order`, `submit_qr_payment`,
--    `verify_payment`, and `enforce_order_update_rules` are NOT touched here.
--    `seller_id` keeps its exact current meaning; this migration only adds the
--    machinery to look up "which shop does this seller belong to" via
--    `shop_users`, for later phases (Products/Orders/Inventory dashboards) to
--    adopt when they actually need shop-scoped data. Rewiring `products`/
--    `orders` to a `shop_id` column is explicit future work, not done here.
--  * `shops` has no `owner_id` column — ownership is expressed entirely
--    through `shop_users`, matching the SAD ERD (`shops ||--o{ shop_users`)
--    and allowing >1 staff per shop later without another migration.
--  * `shop_users` has no membership "role" column — every shop today has
--    exactly one member; a column with one possible value would be
--    speculative (YAGNI).
--  * `is_shop_member()` mirrors `is_admin()`'s exact shape (SECURITY DEFINER,
--    boolean, avoids RLS recursion) so `products`/`orders` RLS can reuse it
--    directly once `shop_id` lands there.
--  * Backfill is idempotent: only `profiles` with `role = 'seller'` and no
--    existing `shop_users` row are backfilled, so re-running this migration
--    (or applying it to a differently-seeded environment) is safe.
--
-- ROLLBACK:
--   drop table public.shop_users;
--   drop table public.shops;
--   drop function public.is_shop_member(uuid);
-- =============================================================================

begin;

-- ----------------------------------------------------------------------------
-- shops
-- ----------------------------------------------------------------------------
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint shops_slug_key unique (slug),
  constraint shops_name_length check (char_length(name) between 1 and 80),
  constraint shops_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- shop_users
-- ----------------------------------------------------------------------------
create table public.shop_users (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint shop_users_unique_membership unique (shop_id, user_id)
);

create index shop_users_shop_id_idx on public.shop_users (shop_id);
create index shop_users_user_id_idx on public.shop_users (user_id);

-- ----------------------------------------------------------------------------
-- is_shop_member(): SECURITY DEFINER to avoid RLS recursion, mirrors
-- is_admin()'s shape exactly.
-- ----------------------------------------------------------------------------
create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_users su
    where su.shop_id = p_shop_id
      and su.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_shop_member(uuid) from public;
grant execute on function public.is_shop_member(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS: deny-by-default. Admin has platform-wide access via is_admin(); a
-- shop member reads only their own shop/membership; buyers get nothing.
-- No self-service create/join — shop and membership management is an
-- admin-only action today, matching the existing precedent that role
-- assignment is already admin-only (prevent_role_self_escalation).
-- ----------------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.shop_users enable row level security;

create policy "shop members and admins read the shop"
  on public.shops for select
  to authenticated
  using (public.is_shop_member(id) or public.is_admin());

create policy "only admins create shops"
  on public.shops for insert
  to authenticated
  with check (public.is_admin());

create policy "only admins update shops"
  on public.shops for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy: deactivate via `active = false`, matching the financial-
-- integrity precedent set by `orders` (no DELETE policy there either).

create policy "users read their own shop membership"
  on public.shop_users for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "only admins create shop memberships"
  on public.shop_users for insert
  to authenticated
  with check (public.is_admin());

create policy "only admins delete shop memberships"
  on public.shop_users for delete
  to authenticated
  using (public.is_admin());

-- No UPDATE policy: membership rows are immutable — delete + reinsert to
-- change who belongs to a shop.

-- Revoke-all-then-regrant least privilege, matching 20260803000100's convention.
revoke all on public.shops from anon, authenticated;
revoke all on public.shop_users from anon, authenticated;

grant select on public.shops to authenticated;
grant insert, update on public.shops to authenticated;
grant select on public.shop_users to authenticated;
grant insert, delete on public.shop_users to authenticated;

-- ----------------------------------------------------------------------------
-- Idempotent backfill: one shop per seller profile without an existing
-- shop_users row. Name/slug derive from full_name (stripping a trailing
-- " Owner"), falling back to username, then a short id suffix.
-- ----------------------------------------------------------------------------
do $$
declare
  seller record;
  v_name text;
  v_slug text;
  v_shop_id uuid;
begin
  for seller in
    select p.id, p.full_name, p.username
    from public.profiles p
    where p.role = 'seller'
      and not exists (
        select 1 from public.shop_users su where su.user_id = p.id
      )
  loop
    v_name := coalesce(
      nullif(trim(regexp_replace(seller.full_name, '\s+Owner$', '', 'i')), ''),
      seller.username,
      'Shop ' || substr(seller.id::text, 1, 8)
    );
    v_slug := public.slugify(v_name) || '-' || substr(seller.id::text, 1, 8);

    insert into public.shops (name, slug, active)
    values (v_name, v_slug, true)
    returning id into v_shop_id;

    insert into public.shop_users (shop_id, user_id)
    values (v_shop_id, seller.id);
  end loop;
end $$;

commit;
