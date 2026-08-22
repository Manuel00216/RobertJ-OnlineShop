-- =============================================================================
-- Account Activation/Deactivation (Admin Center Phase 1): lets an admin stop
-- a buyer or seller account from performing protected actions without
-- deleting anything they own — no cascading delete of orders, payments,
-- products, shop history, or audit logs.
--
-- Design, deliberately narrow:
--  * `profiles.is_active` defaults `true` for every existing and future row.
--    It is NOT added to the existing client column grant
--    (`grant update (full_name, username, avatar_url, phone, bio) on
--    public.profiles to authenticated`, from 20260802160000_security_hardening.sql)
--    — it is simply absent from that allowlist, so no session (buyer, seller,
--    or admin) can ever self-write it via a plain client update. Unlike
--    `role`, this needs no `prevent_role_self_escalation`-style trigger:
--    the column-grant allowlist already is the enforcement.
--  * `admin_set_user_active` is the sole write path — a new `SECURITY
--    DEFINER` RPC mirroring `admin_assign_seller_shop`'s exact shape
--    (explicit `is_admin()` re-derived inside, never trusts RLS alone).
--    Two hard rejections, both defense against locking out platform
--    administration, not UI-only guards:
--      - a caller cannot target their own account (self-lockout protection)
--      - no account with role = 'admin' can ever be targeted (protects
--        every admin account categorically — the same posture
--        `admin_assign_seller_shop` already takes: "Cannot assign a shop to
--        an administrator")
--    Every call inserts one `admin_action_log` row, reusing the table shipped
--    in 20260816000000_admin_user_shop_management.sql — no new logging
--    infrastructure needed.
--  * `admin_list_users()` gains `is_active` as an additional output column
--    only — not a new parameter, so nothing calling it today breaks.
--  * Enforcement of "an inactive session can't act" is intentionally NOT in
--    this migration: `requireSessionUser()`/`getSessionUser()`
--    (`src/lib/supabase/queries.ts`) are the correct layer for that, exactly
--    as documented in ARCHITECTURE.md's RBAC model (service-layer guards
--    sit above RLS, not inside it) — a deactivated user's *existing* Supabase
--    Auth session is still cryptographically valid; this migration only
--    ensures the application layer rejects it, matching how the codebase
--    already treats "signed in" and "authorized to act" as separate checks.
--
-- ROLLBACK:
--   revoke execute on function public.admin_set_user_active(uuid, boolean) from authenticated;
--   drop function public.admin_set_user_active(uuid, boolean);
--   -- admin_list_users: restore the previous return shape from
--   -- 20260816000000_admin_user_shop_management.sql (drop is_active column)
--   alter table public.profiles drop column is_active;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- profiles.is_active
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column is_active boolean not null default true;

comment on column public.profiles.is_active is
  'Admin-controlled account state. Sole write path: admin_set_user_active(). Never in the client self-update column grant.';

-- Self-readable (getSessionUser selects it for the current session's own
-- row) -- not sensitive, same exposure level as role/username, unlike
-- phone's deliberate DEFINER-RPC-only exposure. New columns get no implicit
-- SELECT grant, so this is required, not redundant.
grant select (is_active) on public.profiles to authenticated;


-- -----------------------------------------------------------------------------
-- RPC: admin_set_user_active — the sole write path for activating/
-- deactivating a buyer or seller. Explicitly re-derives and checks admin
-- authorization inside the function — never trusts RLS alone.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_active(
  p_user_id   uuid,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_profile public.profiles;
  v_action  text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to change this account''s status'
      using errcode = '42501';
  end if;

  if p_user_id = v_uid then
    raise exception 'You cannot deactivate your own account' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_profile.role = 'admin' then
    raise exception 'Administrator accounts cannot be deactivated' using errcode = '22023';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id;

  v_action := case when p_is_active then 'reactivate_user' else 'deactivate_user' end;

  insert into public.admin_action_log (
    actor_id, action, target_user_id, metadata
  )
  values (
    v_uid, v_action, p_user_id,
    jsonb_build_object('previous_active', v_profile.is_active, 'new_active', p_is_active)
  );

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

comment on function public.admin_set_user_active is
  'Sole write path for profiles.is_active. Rejects self-targeting and any role=admin target; logs every call to admin_action_log.';

revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- admin_list_users: add is_active to the existing return shape. Postgres
-- rejects CREATE OR REPLACE when a function's RETURNS TABLE column list
-- changes ("cannot change return type of existing function") — DROP first.
-- -----------------------------------------------------------------------------
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id          uuid,
  email       text,
  full_name   text,
  username    text,
  role        public.user_role,
  avatar_url  text,
  created_at  timestamptz,
  shop_id     uuid,
  shop_name   text,
  is_active   boolean
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

  return query
    select
      p.id, u.email::text, p.full_name, p.username, p.role, p.avatar_url, p.created_at,
      s.id as shop_id, s.name as shop_name, p.is_active
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.shop_users su on su.user_id = p.id
    left join public.shops s on s.id = su.shop_id
    order by p.created_at desc;
end;
$$;

comment on function public.admin_list_users is
  'Admin-only user listing with email (joined from auth.users), current shop assignment, and is_active status.';

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

commit;
