-- ------------------------------------------------------------------------
-- OAuth: coalesce provider-specific metadata key names in handle_new_user
-- ------------------------------------------------------------------------
-- Google's normalized OAuth claims populate raw_user_meta_data with
-- `full_name`/`avatar_url`, which handle_new_user already read correctly.
-- Facebook's normalized claims commonly use `name`/`picture` instead, so an
-- unmodified Facebook signup would silently get a blank name/avatar. This
-- migration only widens which keys are read; it does not change what
-- triggers profile creation, the role default, or the error-handling
-- contract below.
--
-- Deliberately NOT touched: this trigger never inspects `new.email` to
-- decide whether to reuse an existing profile — account matching for OAuth
-- is Supabase Auth's (GoTrue's) job, performed before this trigger ever
-- runs, and only for a provider-verified email (see the Identity Linking
-- guide). Adding email-based matching here would bypass that safeguard and
-- reintroduce the pre-account-takeover risk it exists to prevent. This
-- trigger only ever creates a profile for a `new.id` that GoTrue has
-- already decided is a genuinely new user.
--
-- Error handling below intentionally matches the function's CURRENT LIVE
-- definition (`exception when others ... raise warning ... return new`),
-- confirmed via `pg_get_functiondef` before writing this migration — NOT
-- the narrower `when unique_violation` version committed in
-- 20260802160000_security_hardening.sql, which was never actually applied
-- to the live project (documented drift; see DECISIONS.md/memory). Bringing
-- live in line with that repo-intended narrowing is a separate, unrelated
-- change and is deliberately not bundled into this OAuth migration.

begin;

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
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    candidate_username,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      ''
    )), ''),
    'buyer'
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- create or replace does not reliably preserve prior grants across all
-- Postgres versions — re-apply defensively, matching 20260802160000's intent.
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
