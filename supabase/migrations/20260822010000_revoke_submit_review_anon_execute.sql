-- =============================================================================
-- This project grants a default PUBLIC=EXECUTE on newly created functions,
-- which `anon` inherits directly — not just through `public` (see
-- 20260804000300_revoke_create_order_anon_execute.sql, which hit the exact
-- same thing for `create_order`). The `reviews` migration's
-- `revoke all ... from public` on `submit_review` was therefore insufficient;
-- `anon` still had EXECUTE. `submit_review` self-guards (`auth.uid()` is null
-- -> "You must be signed in to write a review"), so this was never
-- exploitable, but it doesn't match this project's least-privilege intent or
-- the pattern every other buyer-write RPC follows.
--
-- ROLLBACK:
--   grant execute on function public.submit_review(uuid, smallint, text) to anon, public;
-- =============================================================================

begin;

revoke execute on function public.submit_review(uuid, smallint, text)
  from public, anon;

grant execute on function public.submit_review(uuid, smallint, text)
  to authenticated;

commit;
