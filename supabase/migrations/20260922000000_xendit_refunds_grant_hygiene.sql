-- =============================================================================
-- Phase 5B grant-hygiene fix (final audit finding): xendit_refunds
-- (20260921000000_xendit_refunds.sql) never explicitly revoked Supabase's
-- default all-privileges grant to anon/authenticated before granting SELECT,
-- unlike every other RPC-only table in this codebase (payments,
-- return_requests, stock_adjustments, ...). Verified NOT exploitable --
-- RLS has no INSERT/UPDATE/DELETE policy on this table, so Postgres already
-- defaults to deny for those commands regardless of the grant -- but the
-- grant state itself should still be least-privilege on its own, matching
-- this codebase's own stated convention (see the original `payments`
-- migration's comment: "grant state must be least-privilege regardless of
-- how the migration is applied").
--
-- No logic, RLS, RPC, or behavior change. Every write to xendit_refunds
-- still only ever happens through decide_return / record_xendit_refund_submission /
-- fail_xendit_refund_submission / process_xendit_refund_webhook, exactly as
-- before this migration.
--
-- ROLLBACK:
--   grant insert, update, delete on public.xendit_refunds to anon, authenticated;
--   (restores the prior, unintentionally-broad grant state -- not recommended)
-- =============================================================================

begin;

revoke all on public.xendit_refunds from anon, authenticated;
grant select on public.xendit_refunds to authenticated;

commit;
