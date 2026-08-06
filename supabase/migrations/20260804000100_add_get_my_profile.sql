-- =============================================================================
-- Ensure get_my_profile() exists (remediation of audit finding H1, part 2).
--
-- The live database (RobertJ-OnlineShop, ref hjxtbnmnwlbqgptgncoh) was missing
-- this function even though migration 20260802160000 defines it. After
-- 20260804000000 restored column-scoped grants (phone withheld from direct
-- SELECT), this SECURITY DEFINER function is the ONLY way a user can read their
-- own phone — without it, /profile cannot resolve the phone field.
--
-- The function was originally authored in migration 20260802160000 (F2); this
-- migration makes the live DB match the repo's intended schema.
--
-- ROLLBACK STRATEGY:
--   drop function public.get_my_profile();
--   -- Reverts the RPC. Note: getMyProfile() in lib/supabase/queries.ts must
--   -- also revert to the direct SELECT, which re-exposes profiles.phone to all
--   -- authenticated users (the very regression H1 removes). Prefer keeping it.
-- =============================================================================

begin;

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

-- Least privilege: only an authenticated caller may invoke it.
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

commit;
