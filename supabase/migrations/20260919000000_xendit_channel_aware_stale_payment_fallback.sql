-- =============================================================================
-- Phase 3 fix #4: a finalized-but-unresolved Xendit payment attempt could
-- remain "active" forever. `payments.expires_at` was always NULL in
-- practice -- every finalize call in xendit.actions.ts hardcoded `null` --
-- and `(expires_at is null or expires_at > now())` treats a NULL expiry as
-- permanently valid. Confirmed via a live audit (Phase 3 fix #4 audit):
--
--  - Card (Sessions API, POST /sessions) DOES return a real `expires_at`
--    (Xendit's documented default: 30 minutes after creation) -- our code
--    was simply discarding it. Fixed separately in
--    src/features/payments/actions/xendit.actions.ts (application-code
--    change, no migration needed for that half).
--  - GCash and Maya (Payment Request API, POST /v3/payment_requests) do NOT
--    return any expiry field in their response at all -- Xendit enforces a
--    documented 15-minute Payment Request Expiry entirely server-side,
--    invisible to the caller. There is nothing for our code to capture.
--
-- Fix (this migration): make the three places that decide "is this payment
-- attempt still active" channel-aware --
--
--  1. If a real `expires_at` is present (now populated for Card), honor it
--     exactly -- unchanged from the fix #3 shape.
--  2. If `expires_at` is NULL (always true for GCash/Maya, and true for any
--     legacy/edge-case Card row that somehow lacks one):
--       - GCASH / PAYMAYA: fall back to 20 minutes after `created_at`.
--         This is OUR OWN APPLICATION SAFETY MARGIN, not a value Xendit
--         documents or returns -- chosen as Xendit's documented 15-minute
--         Payment Request Expiry plus a 5-minute buffer, so we never treat
--         a request as stale before Xendit itself would have expired it.
--       - CARD: fall back to 30 minutes after `created_at`, matching
--         Xendit's own documented Sessions default exactly -- a safety net
--         for the rare case a session response ever lacks `expires_at`,
--         not the expected path once the app-code fix above is live.
--
-- Applied identically to all three places that previously shared the
-- fix #3 "not expired" clause:
--   - begin_xendit_payment_attempt      (single-order reuse-check)
--   - begin_xendit_group_payment_attempt (group reuse-check)
--   - enforce_order_update_rules         (cancellation "active payment" guard)
--
-- Everything else in all three functions is byte-for-byte unchanged from
-- the live fix #3 bodies (confirmed via pg_get_functiondef): the pre-finalize
-- <2-minute window, ownership/ordering checks, transition legality, refund
-- guard, financial-field immutability, COD-collection escape hatch, and all
-- webhook logic (process_xendit_webhook is untouched by this migration).
--
-- ROLLBACK:
--   Restore the previous bodies from
--   20260916140650_xendit_failed_payment_retry.sql (begin_xendit_payment_attempt)
--   and 20260916145554_xendit_cancellation_prefinalize_guard.sql
--   (begin_xendit_group_payment_attempt, enforce_order_update_rules).
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

  if v_order.payment_status not in ('pending', 'failed') then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  -- Idempotent reuse: an in-flight or still-valid attempt is returned as-is
  -- instead of creating a duplicate. "In-flight" = reserved but Xendit
  -- hasn't acknowledged it yet (xendit_payment_request_id is null),
  -- recent enough to still be a live double-click/retry rather than an
  -- abandoned attempt. "Still-valid" = Xendit acknowledged it and either its
  -- real expiry (Card) hasn't passed, or -- when Xendit gives us no expiry
  -- at all (GCash/Maya) -- our own channel-specific safety-margin fallback
  -- window hasn't passed. A terminal 'failed' row from a previous attempt
  -- never matches here (status filter below), so retrying always inserts a
  -- new row and the old failed row is preserved untouched.
  select * into v_payment
  from public.payments
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and payment_channel = p_channel_code
    and status = 'pending'
    and (
      (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
      or (xendit_payment_request_id is not null and expires_at is not null and expires_at > now())
      or (
        xendit_payment_request_id is not null and expires_at is null
        and payment_channel in ('GCASH', 'PAYMAYA')
        and created_at > now() - interval '20 minutes'
      )
      or (
        xendit_payment_request_id is not null and expires_at is null
        and payment_channel = 'CARD'
        and created_at > now() - interval '30 minutes'
      )
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

create or replace function public.begin_xendit_group_payment_attempt(
  p_checkout_group_id uuid,
  p_channel_code       text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_order     public.orders;
  v_result    public.payments;
  v_has_valid boolean;
begin
  if v_uid is null then
    raise exception 'You must be signed in to start a payment' using errcode = '42501';
  end if;

  if p_channel_code not in ('GCASH', 'PAYMAYA', 'CARD') then
    raise exception 'Unsupported payment channel' using errcode = '22023';
  end if;

  perform 1 from public.orders where checkout_group_id = p_checkout_group_id for update;
  if not found then
    raise exception 'Checkout group not found' using errcode = 'P0002';
  end if;

  for v_order in
    select * from public.orders where checkout_group_id = p_checkout_group_id for update
  loop
    if v_order.buyer_id <> v_uid then
      raise exception 'You do not have permission to pay for this order' using errcode = '42501';
    end if;
    if v_order.order_status = 'cancelled' then
      raise exception 'This order has been cancelled' using errcode = '22023';
    end if;
    -- Widened from `<> 'pending'`, same reasoning as the single-order
    -- function above -- 'paid' still blocks the whole group's retry.
    if v_order.payment_status not in ('pending', 'failed') then
      raise exception 'This order is not awaiting payment' using errcode = '22023';
    end if;
  end loop;

  select exists (
    select 1 from public.payments
    where checkout_group_id = p_checkout_group_id
      and payment_channel = p_channel_code
      and status = 'pending'
      and (
        (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
        or (xendit_payment_request_id is not null and expires_at is not null and expires_at > now())
        or (
          xendit_payment_request_id is not null and expires_at is null
          and payment_channel in ('GCASH', 'PAYMAYA')
          and created_at > now() - interval '20 minutes'
        )
        or (
          xendit_payment_request_id is not null and expires_at is null
          and payment_channel = 'CARD'
          and created_at > now() - interval '30 minutes'
        )
      )
  ) into v_has_valid;

  if not v_has_valid then
    insert into public.payments (
      order_id, payment_method_type, payment_channel, amount_cents, currency, status, checkout_group_id
    )
    select o.id, 'xendit', p_channel_code, o.total_cents, o.currency, 'pending', p_checkout_group_id
    from public.orders o
    where o.checkout_group_id = p_checkout_group_id;
  end if;

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id and payment_channel = p_channel_code
  order by created_at desc
  limit 1;

  return v_result;
end;
$$;

create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.order_status = 'cancelled' and old.order_status <> 'cancelled' then
    if exists (
      select 1 from public.payments p
      where p.payment_method_type = 'xendit'
        and p.status = 'pending'
        and (
          (p.xendit_payment_request_id is null and p.created_at > now() - interval '2 minutes')
          or (p.xendit_payment_request_id is not null and p.expires_at is not null and p.expires_at > now())
          or (
            p.xendit_payment_request_id is not null and p.expires_at is null
            and p.payment_channel in ('GCASH', 'PAYMAYA')
            and p.created_at > now() - interval '20 minutes'
          )
          or (
            p.xendit_payment_request_id is not null and p.expires_at is null
            and p.payment_channel = 'CARD'
            and p.created_at > now() - interval '30 minutes'
          )
        )
        and (
          p.order_id = old.id
          or p.checkout_group_id in (
            select checkout_group_id from public.payments
            where order_id = old.id and checkout_group_id is not null
          )
        )
    ) then
      raise exception 'This order has an active online payment in progress and cannot be cancelled right now'
        using errcode = '22023';
    end if;
  end if;

  if v_uid is null or public.is_admin() then
    if new.payment_status is distinct from old.payment_status
       and new.payment_status in ('refunded', 'partially_refunded')
       and coalesce(current_setting('app.refund_in_progress', true), 'false') <> 'true'
    then
      raise exception 'Refunds must go through the return/refund decision flow'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.buyer_id     is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.order_number is distinct from old.order_number
     or new.subtotal_cents is distinct from old.subtotal_cents
     or new.shipping_fee_cents is distinct from old.shipping_fee_cents
     or new.total_cents is distinct from old.total_cents
     or new.currency is distinct from old.currency
  then
    raise exception 'Order financial details cannot be modified'
      using errcode = '42501';
  end if;

  if new.order_status is distinct from old.order_status
     and v_uid <> old.seller_id
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if v_uid = old.seller_id
       and old.payment_status = 'pending'
       and new.payment_status = 'paid'
       and coalesce(current_setting('app.cod_collection_in_progress', true), 'false') = 'true'
    then
      null;
    else
      raise exception 'Payment status is set by the payment provider only'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

commit;
