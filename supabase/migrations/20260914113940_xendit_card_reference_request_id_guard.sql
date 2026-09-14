-- =============================================================================
-- Fix Card payments getting stuck pending after a real successful charge:
--
-- 1. Xendit's Card (Sessions/Components) flow derives the underlying
--    payment_request's reference_id from our payment_session reference_id
--    with an appended suffix ("{ours}_{xendit-suffix}") rather than reusing
--    it verbatim -- confirmed from real webhook deliveries. The route layer
--    (src/app/api/webhooks/xendit/route.ts) now strips that suffix before
--    calling this RPC, so p_reference_id always arrives as our bare payment
--    row uuid again -- no change needed here for that half of the fix.
--
-- 2. Once the reference resolves, the existing xendit_payment_request_id
--    equality guard still failed every Card payment: finalize_xendit_payment_request
--    stores the payment SESSION id (ps-...) at attempt-creation time, since
--    the real underlying payment_request id (pr-...) doesn't exist until the
--    buyer submits the card -- the webhook is the first time we ever learn
--    it. So the stored value and the webhook's claimed value are expected to
--    differ for Card, by design of the Sessions product, not because
--    anything is wrong. GCash/Maya are unaffected: their stored
--    xendit_payment_request_id is the same object throughout, so the check
--    stays exactly as strict as before for them.
--
-- Two narrowly-scoped changes, CREATE OR REPLACE only -- same signature,
-- same grants, no schema change:
--   a) the equality guard is skipped when payment_channel = 'CARD'.
--   b) the terminal "applied" update now also persists the real
--      xendit_payment_request_id it just learned (coalesce, so a value we
--      already have is never overwritten with null), so a duplicate/retried
--      webhook for the same Card payment has a real value to idempotently
--      compare against afterward -- closing the loop the same way GCash/Maya
--      already work.
--
-- ROLLBACK: restore the previous body from
-- 20260914065034_xendit_cancelled_order_guard.sql.
-- =============================================================================

begin;

create or replace function public.process_xendit_webhook(
  p_reference_id              uuid,
  p_xendit_payment_request_id text,
  p_xendit_payment_id         text,
  p_status                    text,
  p_amount_cents              integer,
  p_currency                  text,
  p_raw_payload               jsonb,
  p_channel_code              text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment           public.payments;
  v_order             public.orders;
  v_new_status        public.payment_status;
begin
  select * into v_payment
  from public.payments
  where id = p_reference_id
  for update;

  if not found then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, null, 'unknown_reference', p_raw_payload
    );
    return null;
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_payment.payment_channel <> 'CARD'
     and v_payment.xendit_payment_request_id is distinct from p_xendit_payment_request_id
  then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'reference_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  if v_payment.status in ('paid', 'failed') then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'duplicate_or_late', p_raw_payload
    );
    return v_payment;
  end if;

  -- Order was cancelled (and restocked) out from under this payment attempt.
  -- Don't let a late webhook -- success or failure -- silently resolve it
  -- either way; leave the payment as-is and surface the conflict via the
  -- audit log for manual reconciliation.
  if v_order.order_status = 'cancelled' then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'order_cancelled', p_raw_payload
    );
    return v_payment;
  end if;

  if p_amount_cents is distinct from v_payment.amount_cents
     or p_currency is distinct from v_payment.currency
  then
    update public.payments
    set status = 'failed',
        failure_reason = 'amount_mismatch',
        payment_channel = coalesce(p_channel_code, payment_channel),
        xendit_payment_id = p_xendit_payment_id,
        provider_response = p_raw_payload,
        verified_at = now()
    where id = v_payment.id
    returning * into v_payment;

    update public.orders set payment_status = 'failed' where id = v_order.id;

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'amount_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  v_new_status := case
    when p_status = 'SUCCEEDED' then 'paid'::public.payment_status
    when p_status in ('FAILED', 'EXPIRED', 'CANCELED') then 'failed'::public.payment_status
    else null
  end;

  if v_new_status is null then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'ignored_transient_status', p_raw_payload
    );
    return v_payment;
  end if;

  update public.payments
  set status = v_new_status,
      payment_channel = coalesce(p_channel_code, payment_channel),
      xendit_payment_request_id = coalesce(p_xendit_payment_request_id, xendit_payment_request_id),
      xendit_payment_id = p_xendit_payment_id,
      failure_reason = case when v_new_status = 'failed' then 'xendit_status:' || p_status else null end,
      provider_response = p_raw_payload,
      verified_at = now()
  where id = v_payment.id
  returning * into v_payment;

  update public.orders set payment_status = v_new_status where id = v_order.id;

  insert into public.payment_webhook_events (
    xendit_payment_request_id, xendit_payment_id, reference_id,
    event_type, status, payment_row_id, processing_result, raw_payload
  ) values (
    p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
    'payment', p_status, v_payment.id, 'applied', p_raw_payload
  );

  return v_payment;
end;
$$;

revoke all on function public.process_xendit_webhook(uuid, text, text, text, integer, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.process_xendit_webhook(uuid, text, text, text, integer, text, jsonb, text) to service_role;

commit;
