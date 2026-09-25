-- =============================================================================
-- Forensic capture for Xendit webhook payloads the route can't recognize.
--
-- Closes part of the gap documented in
-- docs/production-card-payment-stuck-audit.md: when
-- src/app/api/webhooks/xendit/route.ts's `referenceId`/`status` extraction
-- fails, the payload was previously only `console.error`'d -- unrecoverable
-- once Vercel's log retention/CLI export missed it, which is exactly what
-- happened for payment_session ps-6ab2814c3589faffa4215ef9 (see the audit;
-- that specific group has since self-healed via the nightly reconciliation
-- sweep, confirming no billing-safety issue, but the payload itself was
-- never captured).
--
-- This does NOT fix extraction -- the actual payload shape causing a future
-- rejection is still unknown. It only makes the next occurrence diagnosable:
-- persist the raw body to the existing, already-forensic-only
-- payment_webhook_events table instead of throwing it away.
--
-- Mirrors process_xendit_webhook's chokepoint: payment_webhook_events' own
-- table comment says "Written only by process_xendit_webhook" -- this keeps
-- that true by routing the write through a second, equally narrow
-- SECURITY DEFINER function rather than opening a direct INSERT grant on the
-- table for application code (service_role already has an implicit owner
-- grant on the table, but the point of the chokepoint is a single audited
-- write path, not just access control).
--
-- ROLLBACK:
--   drop function public.log_unrecognized_xendit_webhook_payload(text, jsonb);
-- =============================================================================

create or replace function public.log_unrecognized_xendit_webhook_payload(
  p_event_type  text,
  p_raw_payload jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payment_webhook_events (
    xendit_payment_request_id, xendit_payment_id, reference_id,
    event_type, status, payment_row_id, processing_result, raw_payload
  ) values (
    null, null, null,
    p_event_type, null, null, 'unrecognized_payload', p_raw_payload
  );
$$;

revoke all on function public.log_unrecognized_xendit_webhook_payload(text, jsonb) from public, anon, authenticated;
grant execute on function public.log_unrecognized_xendit_webhook_payload(text, jsonb) to service_role;
