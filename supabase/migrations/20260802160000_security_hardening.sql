-- =============================================================================
-- Security hardening — addresses findings F1..F5 from the RLS audit.
--
-- F1 HIGH   Privilege escalation to admin via profiles INSERT (exploited in T14)
-- F2 MEDIUM Phone number readable by anonymous visitors
-- F3 MEDIUM Table grants far wider than intended; RLS was the only control
-- F4 LOW    handle_new_user swallowed every error, leaving profile-less users
-- F5 LOW    Helper/trigger functions executable by PUBLIC
--
-- Safe to re-run. Single transaction.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- F1 — Privilege escalation via INSERT  (HIGH, confirmed by execution)
--
-- The original INSERT policy verified only that the row's id matched
-- auth.uid(), and prevent_role_self_escalation was a BEFORE UPDATE trigger.
-- INSERT was therefore completely unguarded: a user with no profile row could
-- insert one with role = 'admin' and gain every is_admin() privilege.
--
-- Two independent controls are applied, either of which closes the hole.
-- -----------------------------------------------------------------------------

-- Control 1: the policy itself only ever admits a 'buyer' row.
drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'buyer'
  );

-- Control 2: the escalation guard now covers INSERT as well as UPDATE.
--
-- On INSERT there is no OLD row, so the baseline is 'buyer' — the same value a
-- legitimate self-service insert would supply. A trusted server context
-- (auth.uid() is null, e.g. handle_new_user or a webhook) is exempt, otherwise
-- signup itself would be blocked.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baseline public.user_role;
begin
  v_baseline := case tg_op
    when 'INSERT' then 'buyer'::public.user_role
    else old.role
  end;

  if new.role is distinct from v_baseline
     and (select auth.uid()) is not null
     and not public.is_admin()
  then
    raise exception 'Only an administrator may assign a user role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_role_self_escalation();


-- -----------------------------------------------------------------------------
-- F2 — Phone number exposed to anonymous visitors  (MEDIUM)
--
-- "profiles are publicly readable" is USING (true) over the whole row, and RLS
-- is row-level: it cannot withhold a column. Any visitor could read every
-- user's phone number.
--
-- Column-level grants are the correct instrument. `bio` stays public — it is
-- seller-facing copy — but `phone` is withheld from everyone, including other
-- authenticated users.
-- -----------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;

grant select (
  id, role, full_name, username, avatar_url, bio, created_at, updated_at
) on public.profiles to anon, authenticated;

-- Owners still need their own phone number. A definer function returns the
-- full row for the caller only, which no column grant can leak.
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p where p.id = (select auth.uid());
$$;

comment on function public.get_my_profile is
  'Full own profile including phone. The phone column is not granted directly.';

-- Owners must still be able to write their own phone.
grant update (full_name, username, avatar_url, phone, bio) on public.profiles
  to authenticated;


-- -----------------------------------------------------------------------------
-- F3 — Least privilege on table grants  (MEDIUM)
--
-- Supabase applies default privileges granting every new table in `public` to
-- anon and authenticated. The initial migration's narrow GRANTs were therefore
-- additive no-ops, and RLS was the sole control.
--
-- TRUNCATE matters most here: it is not governed by RLS at all. It is not
-- reachable through PostgREST today, but the grant should never have existed.
-- -----------------------------------------------------------------------------
revoke all on public.profiles       from anon, authenticated;
revoke all on public.categories     from anon, authenticated;
revoke all on public.products       from anon, authenticated;
revoke all on public.product_images from anon, authenticated;
revoke all on public.orders         from anon, authenticated;
revoke all on public.order_items    from anon, authenticated;

-- Re-grant exactly what each role needs, and nothing more.

-- profiles: column-scoped, as established above.
grant select (
  id, role, full_name, username, avatar_url, bio, created_at, updated_at
) on public.profiles to anon, authenticated;
grant insert on public.profiles to authenticated;
grant update (full_name, username, avatar_url, phone, bio) on public.profiles
  to authenticated;

-- categories: public read; writes gated to admins by RLS.
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- products & images: public read; sellers manage their own via RLS.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

-- orders: anon gets nothing at all — refused at the privilege layer, before
-- RLS is ever consulted.
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;

grant usage on sequence public.order_number_seq to authenticated;

-- Future tables in this schema are not granted to anon automatically.
-- Public read access becomes an explicit, per-table decision.
alter default privileges in schema public revoke all on tables from anon;


-- -----------------------------------------------------------------------------
-- F4 — handle_new_user swallowed every error  (LOW, enabler of F1)
--
-- `exception when others then return new` meant a failure left an account with
-- no profile row — precisely the state F1 exploited.
--
-- Now only a unique_violation is tolerated (a concurrent insert already did the
-- work). Anything else propagates and fails the signup loudly.
--
-- Deliberate tradeoff: a failed signup is visible and fixable; a silently
-- profile-less account is neither. With F1 closed this is a data-integrity
-- concern rather than a security one, but silent corruption is still worse
-- than a loud failure.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
begin
  candidate_username := public.slugify(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    )
  );
  candidate_username := replace(candidate_username, '-', '_');

  if candidate_username !~ '^[a-z0-9_]{3,30}$'
     or exists (select 1 from public.profiles p where lower(p.username) = candidate_username)
  then
    candidate_username := null;
  end if;

  insert into public.profiles (id, full_name, username, avatar_url, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    candidate_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
    'buyer'
  )
  on conflict (id) do nothing;

  return new;
exception
  when unique_violation then
    -- A concurrent signup path already created the row. Not an error.
    return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- F5 — Functions executable by PUBLIC  (LOW)
--
-- Postgres grants EXECUTE to PUBLIC on every new function. Trigger functions
-- cannot be invoked directly (verified in the audit), but the grant is still
-- surface area that serves no purpose.
-- -----------------------------------------------------------------------------
revoke all on function public.set_updated_at()                      from public, anon, authenticated;
revoke all on function public.handle_new_user()                     from public, anon, authenticated;
revoke all on function public.assign_order_number()                 from public, anon, authenticated;
revoke all on function public.track_order_status_timestamps()       from public, anon, authenticated;
revoke all on function public.track_product_published_at()          from public, anon, authenticated;
revoke all on function public.prevent_role_self_escalation()        from public, anon, authenticated;
revoke all on function public.enforce_order_update_rules()          from public, anon, authenticated;
revoke all on function public.unaccent_fallback(text)               from public, anon;

revoke all on function public.create_order(uuid, jsonb, jsonb, integer, text)
  from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text)
  to authenticated;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- These are read by RLS policies evaluated for both roles, so both keep EXECUTE.
grant execute on function public.is_admin()          to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.slugify(text)       to authenticated;

commit;
