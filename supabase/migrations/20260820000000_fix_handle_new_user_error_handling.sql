-- Fix handle_new_user() error handling: narrow the exception handler to only
-- swallow unique_violation (a possible username-collision race under the
-- check-then-insert flow below), and sanitize full_name/avatar_url so a
-- legitimate OAuth signup can't trip a CHECK constraint in the first place.
-- Previously *any* error (including a CHECK violation) was silently
-- swallowed, leaving an auth.users row with no matching profiles row and no
-- visibility into why.
--
-- Confirmed live via pg_get_functiondef before writing this migration: the
-- function was still on the original broad `when others` catch-all from
-- initial_schema.sql; the narrower `when unique_violation` intent authored
-- in 20260802160000_security_hardening.sql was never applied live (that
-- migration itself was skipped live). This migration targets only
-- handle_new_user()'s error handling and input sanitization; no RLS policy,
-- grant, or other function is touched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
  candidate_full_name text;
  candidate_avatar_url text;
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

  -- Truncate to profiles_full_name_length's 120-char cap instead of letting
  -- an oversized OAuth display name fail the whole signup.
  candidate_full_name := nullif(left(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), 120), '');

  -- Drop anything that isn't a plain http(s) URL instead of letting a
  -- provider-supplied value fail profiles_avatar_url_scheme.
  candidate_avatar_url := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  )), '');
  if candidate_avatar_url is not null and candidate_avatar_url !~ '^https?://' then
    candidate_avatar_url := null;
  end if;

  insert into public.profiles (id, full_name, username, avatar_url, role)
  values (new.id, candidate_full_name, candidate_username, candidate_avatar_url, 'buyer')
  on conflict (id) do nothing;

  return new;
exception
  when unique_violation then
    raise warning 'handle_new_user: unique_violation for %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
