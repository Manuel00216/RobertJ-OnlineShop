-- =============================================================================
-- Fix: Postgres grants EXECUTE to PUBLIC by default on a newly created
-- function unless explicitly revoked — the established convention in this
-- codebase (request_return/respond_to_return/decide_return, see
-- 20260826000000_returns_and_refunds.sql) is always
-- `revoke all ... from public, anon;` before granting to the intended role.
-- Both new RPCs from this batch of migrations skipped that revoke.
--
-- `expire_unpaid_xendit_order` has NO internal auth.uid() check at all — it
-- is designed to run only via the service-role client from the
-- xendit-reconciliation cron, which does its own Xendit-reconciliation
-- safety check BEFORE calling it. Left world-callable, anyone (even
-- unauthenticated) could invoke it directly via PostgREST and cancel any
-- order that happens to be pending/unpaid-by-payment_status/xendit/>24h old
-- — skipping the reconciliation safety net entirely and potentially
-- cancelling an order Xendit had actually just charged (payment_status not
-- yet updated by the webhook). This revokes public/anon/authenticated,
-- leaving only postgres/service_role — matching process_xendit_webhook's
-- exact lockdown.
--
-- `record_return_item_condition` already has a real internal ownership/role
-- check (seller_id/is_shop_member/is_admin), so this was hygiene rather than
-- an exploitable hole — revoked from public/anon anyway to match the
-- established convention and keep the authenticated-only grant explicit
-- rather than incidental.
-- =============================================================================

begin;

revoke all on function public.expire_unpaid_xendit_order(uuid) from public, anon, authenticated;

revoke all on function public.record_return_item_condition(uuid, text, text) from public, anon;
grant execute on function public.record_return_item_condition(uuid, text, text) to authenticated;

commit;
