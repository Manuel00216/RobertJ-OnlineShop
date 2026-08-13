-- =============================================================================
-- Admin User & Shop Management / Seller Onboarding (Phase 6): the missing
-- piece connecting `profiles`/`shops`/`shop_users` — until now, becoming a
-- seller was only possible via direct SQL (`profiles` UPDATE RLS is
-- self-only; `prevent_role_self_escalation`'s `is_admin()` bypass has been
-- unreachable dead code for cross-user promotion, since RLS never exposed
-- another user's row to an admin in the first place).
--
-- Design, deliberately narrow:
--  * Public signup stays Buyer-only. `handle_new_user()`, the `profiles`
--    INSERT policy, and `prevent_role_self_escalation` are all untouched —
--    this migration only ADDS an admin-only path, it does not widen the
--    self-service one.
--  * Shop CRUD needs NO new RPC: `shops` INSERT/UPDATE RLS is already
--    `is_admin()`-gated and unrestricted (same as `products`) — admin can
--    already create/edit shops via a plain client call.
--  * Promoting a user (writing another person's `profiles.role`) and
--    (re)assigning their `shop_users` membership atomically DOES need a new
--    `SECURITY DEFINER` RPC — `admin_assign_seller_shop` — mirroring
--    `create_order`/`adjust_stock`/`verify_payment`'s chokepoint shape:
--    explicit `is_admin()` check inside (never trust RLS alone), and it's
--    the SOLE write path (role change + shop_users delete-then-insert +
--    audit-log row, one transaction, no window where a seller exists
--    without a shop or belongs to two).
--  * `admin_list_users()` is a second new `SECURITY DEFINER` RPC (same
--    explicit-check shape) because it needs `auth.users.email`, which is
--    never joinable through RLS/PostgREST from `public.profiles` alone —
--    mirrors `get_my_profile()`'s shape, but admin-scoped instead of
--    self-scoped.
--  * `admin_action_log` deliberately logs ONLY `admin_assign_seller_shop` —
--    the one high-stakes atomic action. Shop create/edit stay plain,
--    unlogged RLS-gated writes (matching the existing precedent that
--    archiving a product isn't logged either); converting them into RPCs
--    just to get logging would be scope creep for a capability nobody asked
--    to have audited.
--  * `shop_users_unique_user`: today's schema only has a composite
--    `unique (shop_id, user_id)`, so nothing stops a user ending up in two
--    shops, and `requireOwnShopId()`'s `.maybeSingle()` would surface a raw,
--    unfriendly error if that ever happened. Verified safe against live data
--    before writing this file (3 rows, 3 distinct user_ids, 0 duplicates).
--
-- ROLLBACK:
--   revoke execute on function public.admin_list_users() from authenticated;
--   drop function public.admin_list_users();
--   revoke execute on function public.admin_assign_seller_shop(uuid, uuid) from authenticated;
--   drop function public.admin_assign_seller_shop(uuid, uuid);
--   drop policy "admins read the action log" on public.admin_action_log;
--   drop table public.admin_action_log;
--   alter table public.shop_users drop constraint shop_users_unique_user;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- shop_users: close the "user in two shops" gap additively.
-- -----------------------------------------------------------------------------
alter table public.shop_users
  add constraint shop_users_unique_user unique (user_id);

-- -----------------------------------------------------------------------------
-- admin_action_log — append-only, admin-only-readable, RPC-only-writable.
-- Mirrors stock_adjustments'/payments' "no direct table grant" precedent.
-- -----------------------------------------------------------------------------
create table public.admin_action_log (
  id                uuid primary key default gen_random_uuid(),
  actor_id          uuid references public.profiles (id) on delete set null,
  action            text not null,
  target_user_id    uuid references public.profiles (id) on delete set null,
  target_shop_id    uuid references public.shops (id) on delete set null,
  metadata          jsonb,
  created_at        timestamptz not null default now(),

  constraint admin_action_log_action_length check (char_length(action) between 1 and 60)
);

comment on table public.admin_action_log is
  'Append-only audit trail for high-stakes admin actions. Currently written only by admin_assign_seller_shop.';

create index admin_action_log_actor_id_created_idx
  on public.admin_action_log (actor_id, created_at desc);
create index admin_action_log_target_user_id_idx
  on public.admin_action_log (target_user_id);
create index admin_action_log_target_shop_id_idx
  on public.admin_action_log (target_shop_id);

alter table public.admin_action_log enable row level security;

create policy "admins read the action log"
  on public.admin_action_log for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy: writes are RPC-only (admin_assign_seller_shop).

grant select on public.admin_action_log to authenticated;
-- No insert/update/delete grant — matches the RLS above.


-- -----------------------------------------------------------------------------
-- RPC: admin_assign_seller_shop — the sole write path for promoting a buyer
-- to seller and/or (re)assigning their shop. Explicitly re-derives and
-- checks admin authorization inside the function — never trusts RLS alone.
-- -----------------------------------------------------------------------------
create or replace function public.admin_assign_seller_shop(
  p_user_id uuid,
  p_shop_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_profile        public.profiles;
  v_shop           public.shops;
  v_previous_role  public.user_role;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to assign a seller to a shop'
      using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_profile.role = 'admin' then
    raise exception 'Cannot assign a shop to an administrator' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Shop not found' using errcode = 'P0002';
  end if;
  if not v_shop.active then
    raise exception 'Cannot assign a seller to an inactive shop' using errcode = '22023';
  end if;

  v_previous_role := v_profile.role;

  if v_profile.role = 'buyer' then
    update public.profiles set role = 'seller' where id = p_user_id;
  end if;

  -- Delete-then-insert: never a window with zero or two memberships, and
  -- makes this the sole path for both promotion and later reassignment.
  delete from public.shop_users where user_id = p_user_id;
  insert into public.shop_users (shop_id, user_id) values (p_shop_id, p_user_id);

  insert into public.admin_action_log (
    actor_id, action, target_user_id, target_shop_id, metadata
  )
  values (
    v_uid, 'assign_seller_shop', p_user_id, p_shop_id,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'new_role', 'seller',
      'shop_name', v_shop.name
    )
  );

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

comment on function public.admin_assign_seller_shop is
  'Sole write path for promoting a buyer to seller and/or (re)assigning their shop_users membership. Atomic — never leaves a seller without a shop.';

revoke all on function public.admin_assign_seller_shop(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_seller_shop(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- RPC: admin_list_users — admin-only listing with email (joined from
-- auth.users, never otherwise exposed) and current shop assignment.
-- Mirrors get_my_profile()'s shape, but admin-scoped instead of self-scoped.
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id          uuid,
  email       text,
  full_name   text,
  username    text,
  role        public.user_role,
  avatar_url  text,
  created_at  timestamptz,
  shop_id     uuid,
  shop_name   text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'You do not have permission to list users' using errcode = '42501';
  end if;

  -- auth.users.email is varchar(255); cast to text to match the declared
  -- return type (discovered via live verification, not assumed).
  return query
    select
      p.id, u.email::text, p.full_name, p.username, p.role, p.avatar_url, p.created_at,
      s.id as shop_id, s.name as shop_name
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.shop_users su on su.user_id = p.id
    left join public.shops s on s.id = su.shop_id
    order by p.created_at desc;
end;
$$;

comment on function public.admin_list_users is
  'Admin-only user listing with email (joined from auth.users) and current shop assignment.';

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

commit;
