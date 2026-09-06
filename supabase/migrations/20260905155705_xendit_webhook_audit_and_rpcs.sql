-- =============================================================================
-- Xendit Online Payment, part 2: the audit table + the three SECURITY DEFINER
-- RPCs that are the sole write path for Xendit payment attempts (mirrors
-- create_order/submit_qr_payment's chokepoint philosophy — no direct
-- INSERT/UPDATE grants are opened on `payments`).
--
--  * begin_xendit_payment_attempt  — buyer-authenticated. Idempotently
--    reserves ONE payments row per "intent" (double-click / retry safe at
--    the DB layer, independent of Xendit's own Idempotency-Key header).
--  * finalize_xendit_payment_request — buyer-authenticated. Narrowly scoped
--    update of the exact row just reserved, once we have Xendit's response.
--  * process_xendit_webhook — service_role ONLY (explicitly revoked from
--    public/anon/authenticated). This is the sole path by which a payment
--    can become 'paid'. Idempotent: a payment already in a terminal state is
--    a no-op, which also correctly handles out-of-order delivery. Every
--    invocation is logged to payment_webhook_events regardless of outcome.
--
-- amount_cents is passed in already converted from Xendit's wire format by
-- the caller (the webhook Route Handler) — the conversion helper lives in
-- TypeScript (src/lib/xendit/client.ts) as a single, unit-tested source of
-- truth shared between the create-request and confirm-webhook paths, rather
-- than duplicated/hand-rolled again here in SQL.
--
-- NOTE: this migration's original parameter order for process_xendit_webhook
-- (p_channel_code before required params) is corrected in the follow-up
-- migration 20260905162555_xendit_rpc_optional_params_fixed.sql — Postgres
-- requires all parameters after one with a DEFAULT to also have defaults.
--
-- ROLLBACK:
--   drop function public.process_xendit_webhook(uuid, text, text, text, text, integer, text, jsonb);
--   drop function public.finalize_xendit_payment_request(uuid, text, text, timestamptz, text);
--   drop function public.begin_xendit_payment_attempt(uuid, text);
--   drop table public.payment_webhook_events;
-- =============================================================================

begin;

create table public.payment_webhook_events (
  id                         uuid primary key default gen_random_uuid(),
  received_at                timestamptz not null default now(),
  xendit_payment_request_id  text,
  xendit_payment_id          text,
  reference_id               uuid,
  event_type                 text,
  status                     text,
  payment_row_id             uuid references public.payments (id),
  processing_result          text not null,
  raw_payload                jsonb not null
);

comment on table public.payment_webhook_events is
  'Immutable audit log of every Xendit webhook delivery this app accepted (post signature-check), regardless of processing outcome. Written only by process_xendit_webhook. Makes duplicate/out-of-order webhook handling forensically auditable rather than just asserted.';

create index payment_webhook_events_reference_id_idx on public.payment_webhook_events (reference_id);
create index payment_webhook_events_payment_row_id_idx on public.payment_webhook_events (payment_row_id);

alter table public.payment_webhook_events enable row level security;
-- Deliberately zero policies: not reachable via PostgREST by any role at all
-- (including authenticated/admin) — this is an internal forensic log, read
-- via direct DB access, not an app-facing table. Written only by
-- process_xendit_webhook, a SECURITY DEFINER function owned by the table
-- owner, which bypasses RLS the same way create_order bypasses orders' RLS
-- to decrement stock.
revoke all on public.payment_webhook_events from public, anon, authenticated;


-- --- 1. begin_xendit_payment_attempt -----------------------------------------
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


-- --- 2. finalize_xendit_payment_request ---------------------------------------
create or replace function public.finalize_xendit_payment_request(
  p_payment_id                 uuid,
  p_xendit_payment_request_id  text,
  p_checkout_url               text,
  p_expires_at                 timestamptz,
  p_status                     text default 'pending'
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_payment public.payments;
  v_order   public.orders;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment attempt not found' using errcode = 'P0002';
  end if;

  if v_payment.payment_method_type <> 'xendit' then
    raise exception 'Not a Xendit payment attempt' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to modify this payment'
      using errcode = '42501';
  end if;

  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.finalize_xendit_payment_request(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.finalize_xendit_payment_request(uuid, text, text, timestamptz, text) to authenticated;


-- --- 3. process_xendit_webhook -------------------------------------------------
create or replace function public.process_xendit_webhook(
  p_reference_id              uuid,
  p_xendit_payment_request_id text,
  p_xendit_payment_id         text,
  p_status                    text,
  p_channel_code              text,
  p_amount_cents              integer,
  p_currency                  text,
  p_raw_payload               jsonb
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

  -- Cross-check: the reference_id resolved a row, but its stored Xendit
  -- request id must match what the webhook says it's confirming.
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

  -- Idempotency + out-of-order guard: once terminal, nothing (including a
  -- stale/duplicate event) can change it again.
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

  -- Validate, don't trust: amount/currency must match what we recorded when
  -- the attempt was created.
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
    -- PENDING / REQUIRES_ACTION / AUTHORIZED — still in flight, log only.
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

revoke all on function public.process_xendit_webhook(uuid, text, text, text, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_xendit_webhook(uuid, text, text, text, text, integer, text, jsonb) to service_role;

commit;
