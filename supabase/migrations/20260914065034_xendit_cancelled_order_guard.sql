-- =============================================================================
-- Close a race between order cancellation and an in-flight/late Xendit
-- payment: a buyer could start (or already have started) a Xendit payment,
-- cancel the order in a second tab (order_status -> 'cancelled', which
-- restocks via orders_restock_on_cancel), then complete the payment anyway.
-- Nothing previously stopped `begin_xendit_payment_attempt` from reserving a
-- fresh attempt against a cancelled order, nor stopped a subsequent webhook
-- from flipping `orders.payment_status` to 'paid' on it.
--
-- Two guards, both additive, no signature change (CREATE OR REPLACE only):
--
--  1. begin_xendit_payment_attempt: refuses to start (or resume) an attempt
--     once order_status = 'cancelled'. Placed alongside the existing
--     payment_status check, same errcode convention.
--
--  2. process_xendit_webhook: once order_status = 'cancelled', a webhook for
--     that order's payment is logged (new processing_result
--     'order_cancelled') and left otherwise untouched -- neither 'paid' nor
--     'failed' is applied. This mirrors the existing "don't silently guess"
--     posture already used for reference/amount mismatches: a payment stuck
--     pending against a cancelled order is a visible signal for a seller/
--     admin to reconcile manually (same accepted manual-remedy pattern as
--     TD-9 in ARCHITECTURE.md), rather than the webhook inventing a status
--     transition for a state it was never designed to resolve.
--
--     Checked after the existing terminal-state (paid/failed) idempotency
--     guard, so a payment that was already resolved before cancellation
--     keeps hitting the ordinary 'duplicate_or_late' branch on replay --
--     this only intercepts a payment still 'pending' at cancellation time.
--
-- ROLLBACK:
--   Restore the previous bodies of both functions from
--   20260905162555_xendit_rpc_optional_params_fixed.sql (process_xendit_webhook)
--   and 20260905155705_xendit_webhook_audit_and_rpcs.sql (begin_xendit_payment_attempt).
-- =============================================================================

begin;

create or replace function public.begin_xendit_payment_attempt(
  p_order_id     uuid,
  p_channel_code text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'You must be signed in to start a payment' using errcode = '42501';
  end if;

  if p_channel_code not in ('GCASH', 'PAYMAYA', 'CARD') then
    raise exception 'Unsupported payment channel' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to pay for this order'
      using errcode = '42501';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'This order has been cancelled' using errcode = '22023';
  end if;

  if v_order.payment_status <> 'pending' then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  -- Idempotent reuse: an in-flight or still-valid attempt is returned as-is
  -- instead of creating a duplicate. "In-flight" = reserved but Xendit
  -- hasn't acknowledged it yet (xendit_payment_request_id is null),
  -- recent enough to still be a live double-click/retry rather than an
  -- abandoned attempt. "Still-valid" = Xendit acknowledged it and it hasn't
  -- expired yet.
  select * into v_payment
  from public.payments
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and status = 'pending'
    and (
      (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
      or (xendit_payment_request_id is not null and (expires_at is null or expires_at > now()))
    )
  order by created_at desc
  limit 1
  for update;

  if found then
    return v_payment;
  end if;

  insert into public.payments (
    order_id, payment_method_type, payment_channel, amount_cents, currency, status
  ) values (
    p_order_id, 'xendit', p_channel_code, v_order.total_cents, v_order.currency, 'pending'
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.begin_xendit_payment_attempt(uuid, text) from public, anon;
grant execute on function public.begin_xendit_payment_attempt(uuid, text) to authenticated;


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

  if v_payment.xendit_payment_request_id is distinct from p_xendit_payment_request_id then
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

  -- New guard: the order was cancelled (and restocked) out from under this
  -- payment attempt. Don't let a late webhook -- success or failure --
  -- silently resolve it either way; leave the payment as-is and surface the
  -- conflict via the audit log for manual reconciliation.
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
