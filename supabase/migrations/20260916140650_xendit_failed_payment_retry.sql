-- =============================================================================
-- Phase 3 fix #1: allow a buyer to retry a FAILED/EXPIRED/CANCELED Xendit
-- payment. Today, once `process_xendit_webhook` sets `orders.payment_status`
-- to 'failed', both `begin_xendit_payment_attempt` (single-seller) and
-- `begin_xendit_group_payment_attempt` (multi-seller) permanently refuse to
-- start a new attempt, because each requires `payment_status = 'pending'`.
-- The buyer is stuck with no way to pay online again.
--
-- Fix: widen that one guard in each function from `<> 'pending'` to
-- `not in ('pending', 'failed')`. Everything else is byte-for-byte identical
-- to the current live bodies (confirmed via pg_get_functiondef):
--
--  - `paid` and `cancelled` orders are still rejected -- successful payments
--    and cancelled orders are untouched (unaffected requirements).
--  - The existing idempotent reuse-check (scoped to `status = 'pending'`
--    payment rows) is untouched, so double-click/multi-tab protection is
--    unchanged: it simply no longer matches the old terminal 'failed' row,
--    so a genuinely new `payments` row is inserted for the retry while the
--    previous failed row is preserved untouched for history/audit.
--  - No column, signature, or grant changes.
--
-- ROLLBACK:
--   Restore the previous bodies from
--   20260914065034_xendit_cancelled_order_guard.sql (begin_xendit_payment_attempt)
--   and 20260914132906_xendit_phase2_multiseller_group_payment.sql
--   (begin_xendit_group_payment_attempt).
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

  -- Widened from `<> 'pending'`: a 'failed' order (FAILED/EXPIRED/CANCELED
  -- Xendit outcome) may start a fresh attempt. 'paid' still falls through
  -- to this exception, unchanged.
  if v_order.payment_status not in ('pending', 'failed') then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  -- Idempotent reuse: an in-flight or still-valid attempt is returned as-is
  -- instead of creating a duplicate. "In-flight" = reserved but Xendit
  -- hasn't acknowledged it yet (xendit_payment_request_id is null),
  -- recent enough to still be a live double-click/retry rather than an
  -- abandoned attempt. "Still-valid" = Xendit acknowledged it and it hasn't
  -- expired yet. A terminal 'failed' row from a previous attempt never
  -- matches here (status filter below), so retrying always inserts a new
  -- row and the old failed row is preserved untouched.
  select * into v_payment
  from public.payments
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and payment_channel = p_channel_code
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
        or (xendit_payment_request_id is not null and (expires_at is null or expires_at > now()))
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

revoke all on function public.begin_xendit_group_payment_attempt(uuid, text) from public, anon;
grant execute on function public.begin_xendit_group_payment_attempt(uuid, text) to authenticated;

commit;
