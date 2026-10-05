-- =============================================================================
-- Admin audit fix #8 — getAdminUserById fetched every user just to find one.
--
-- `admin_list_users()` had no filter parameter at all, so the by-id lookup
-- (queries.ts getAdminUserById) called it and did a client-side `.find()`
-- over the full result. Acceptable at today's scale (the user base is
-- small), but wasteful, and worth closing while it's cheap.
--
-- Adds an optional p_user_id parameter: adding a parameter changes the
-- function's signature, so this is a DROP + CREATE (not a same-signature
-- CREATE OR REPLACE) — same pattern as every other param-added RPC in this
-- schema. Recreating resets the ACL to the PUBLIC-EXECUTE default, so the
-- grants are explicitly re-applied below (authenticated + service_role
-- only, no anon — verified live immediately after, matching the signature
-- before this change).
--
-- Omitting p_user_id (every existing caller) returns the full list,
-- unchanged from before.
--
-- ROLLBACK:
--   drop function if exists public.admin_list_users(uuid);
--   create function public.admin_list_users() returns table (...) ... (see 20260816000000_admin_user_shop_management.sql's original body, plus the is_active column added since)
-- =============================================================================

begin;

drop function if exists public.admin_list_users();

create function public.admin_list_users(p_user_id uuid default null)
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
    where p_user_id is null or p.id = p_user_id
    order by p.created_at desc;
end;
$$;

comment on function public.admin_list_users is
  'Admin-only user listing with email (joined from auth.users) and current shop assignment. p_user_id optionally narrows to one user (added so getAdminUserById avoids fetching every user for a single lookup) -- omit it for the full list, unchanged from before.';

revoke all on function public.admin_list_users(uuid) from public, anon;
grant execute on function public.admin_list_users(uuid) to authenticated;

commit;
