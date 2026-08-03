-- =============================================================================
-- RLS hardening — follow-up to the initial schema audit.
--
-- Fixes (verified by execution in the audit):
--   F1  Privilege escalation: a profile-less user could INSERT their own
--       profile with role='admin'. The escalation guard was BEFORE UPDATE only,
--       and the INSERT policy did not constrain the role column.
--   F2  PII exposure: the public profiles SELECT policy exposed `phone` to anon.
--   F3  Over-broad grants: anon/authenticated held ALL (incl. INSERT/UPDATE/
--       DELETE/TRUNCATE) on every table via Supabase default privileges, making
--       RLS the only barrier. Reduced to least privilege.
--   F5  Default PUBLIC EXECUTE on internal/trigger functions revoked.
--
-- Note (F4): public.handle_new_user() intentionally still swallows errors to keep
-- signup resilient. With F1 in place a missing profile is no longer exploitable;
-- backfill any profile-less users out of band rather than making signup brittle.
-- =============================================================================

begin;

-- ----------------------------------------------------------------------------
-- F1: role self-escalation guard now covers INSERT as well as UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- A self-served profile row may only be a 'buyer'. Role elevation is an
    -- administrative action, never something a user performs on their own row.
    if new.role <> 'buyer'
       and (select auth.uid()) is not null
       and not public.is_admin() then
      raise exception 'You may not self-assign a privileged role'
        using errcode = '42501';
    end if;
  else
    if new.role is distinct from old.role
       and (select auth.uid()) is not null
       and not public.is_admin() then
      raise exception 'Only an administrator may change a user role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation_insert on public.profiles;
create trigger profiles_prevent_role_escalation_insert
  before insert on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- Declarative backstop in the policy itself.
drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()) and role = 'buyer');

-- ----------------------------------------------------------------------------
-- F3 + F2: reset to least privilege, then re-grant the intended surface.
-- anon does NOT receive the `phone` column (F2).
-- service_role is intentionally left untouched (it bypasses RLS by design).
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Anonymous: read-only, public-safe columns only (no phone).
grant select (id, role, full_name, username, avatar_url, bio, created_at, updated_at)
  on public.profiles to anon;
grant select on public.categories, public.products, public.product_images to anon;

-- Authenticated: full-row read (needed to manage one's own profile) + intended writes.
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update on public.orders to authenticated;   -- no delete: matches no-delete policy
grant select, insert on public.order_items to authenticated;      -- immutable line items

grant usage on sequence public.order_number_seq to authenticated;

-- ----------------------------------------------------------------------------
-- F5: revoke EXECUTE on internal + trigger functions. Supabase's default
-- privileges grant EXECUTE to anon/authenticated *explicitly* (not via PUBLIC),
-- so all three grantees must be named. Trigger functions do not require EXECUTE
-- to fire, and slugify/unaccent_fallback are only called from a definer context,
-- so revoking here is safe.
-- ----------------------------------------------------------------------------
revoke execute on function public.set_updated_at()                 from public, anon, authenticated;
revoke execute on function public.assign_order_number()            from public, anon, authenticated;
revoke execute on function public.track_order_status_timestamps()  from public, anon, authenticated;
revoke execute on function public.track_product_published_at()     from public, anon, authenticated;
revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.enforce_order_update_rules()     from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation()   from public, anon, authenticated;
revoke execute on function public.slugify(text)                    from public, anon, authenticated;
revoke execute on function public.unaccent_fallback(text)          from public, anon, authenticated;

-- Re-affirm the intentionally-callable surface.
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text) to authenticated;
grant execute on function public.is_admin()          to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;

commit;
