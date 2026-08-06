-- =============================================================================
-- Reconcile the live database with the repo's least-privilege intent (audit M1).
--
-- The live project (RobertJ-OnlineShop, ref hjxtbnmnwlbqgptgncoh) was built from
-- a different migration history than supabase/migrations/ (its `rls_hardening`
-- / `rls_hardening_fn_execute` steps are not in the repo), so the `anon` EXECUTE
-- revocation on the SECURITY DEFINER `create_order` RPC — originally authored in
-- the repo's 20260802160000_security_hardening.sql — was never applied live.
--
-- create_order self-guards (`auth.uid()` is null -> 'Authentication required'),
-- so this is defense-in-depth / least-privilege rather than a vulnerability
-- fix, but the Supabase advisor flags the anon EXECUTE and the repo intends it
-- revoked. Live also carries a default PUBLIC=EXECUTE (a fresh function's
-- default), which anon inherits, so BOTH `public` and `anon` must be revoked.
-- `authenticated` keeps EXECUTE: checkout calls it via
-- `placeOrderAction` -> `queries.createOrder`.
--
-- ROLLBACK:
--   grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text) to anon;
--   grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text) to public;
-- =============================================================================

begin;

revoke execute on function public.create_order(uuid, jsonb, jsonb, integer, text)
  from public, anon;

grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text)
  to authenticated;

commit;
