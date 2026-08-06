-- =============================================================================
-- Restore least-privilege grants on profiles (remediation of audit finding H1).
--
-- Audit finding: migration 20260803000100 re-granted FULL-ROW SELECT on
-- public.profiles to authenticated (line 80). Combined with the "profiles are
-- publicly readable" SELECT policy (USING true, initial_schema line 807), any
-- signed-in user could SELECT the `phone` column of every user — a PII
-- regression that contradicted migration 20260802160000 (F2) and
-- docs/database.md §4.
--
-- This migration re-scopes the authenticated SELECT to the same public column
-- set anon receives (`phone` withheld) and narrows UPDATE back to the editable
-- columns. get_my_profile() (SECURITY DEFINER, created in migration 02160000,
-- EXECUTE granted to authenticated) remains the only path by which a user can
-- read their own phone.
--
-- ROLLBACK STRATEGY (emergency restore of the migration-3 state).
-- Apply the following if this change must be reverted:
--
--   begin;
--   revoke select (id, role, full_name, username, avatar_url, bio, created_at, updated_at)
--     on public.profiles from authenticated;
--   grant select on public.profiles to authenticated;   -- full-row (migration-3 state)
--   revoke update (full_name, username, avatar_url, phone, bio) on public.profiles
--     from authenticated;
--   grant update on public.profiles to authenticated;   -- full-row
--   commit;
--
--   WARNING: rolling back re-exposes profiles.phone to every authenticated user
--   and requires getMyProfile() in lib/supabase/queries.ts to revert to the
--   direct SELECT. Keep the RPC path unless restoring is unavoidable.
--
-- Apply with: npx supabase db push   (or the Supabase MCP apply_migration tool,
-- target project RobertJ-OnlineShop ref hjxtbnmnwlbqgptgncoh).
-- =============================================================================

begin;

-- Revoke the over-broad full-row grants added by 20260803000100.
revoke select on public.profiles from authenticated;
revoke update on public.profiles from authenticated;

-- Re-grant the same column-scoped surface anon receives (phone withheld).
grant select (
  id, role, full_name, username, avatar_url, bio, created_at, updated_at
) on public.profiles to authenticated;

-- Owners may edit their own profile; phone stays writable by the owner
-- (own-row UPDATE via RLS) but is not directly readable except via the RPC.
grant update (full_name, username, avatar_url, phone, bio)
  on public.profiles to authenticated;

commit;
