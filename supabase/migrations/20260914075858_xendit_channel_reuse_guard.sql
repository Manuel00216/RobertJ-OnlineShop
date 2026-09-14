-- =============================================================================
-- Fix: begin_xendit_payment_attempt's idempotent-reuse query did not filter
-- by payment_channel, so a buyer switching payment method on the same order
-- within the reuse window (e.g. clicks "Pay with Card", then within ~2
-- minutes clicks "Pay with GCash" instead) would silently reuse the
-- CARD-labeled row and finalize it with a GCash payment_request -- the row's
-- payment_channel stays wrong forever after. Confirmed against real data:
-- payment 72e03e9f... is stored payment_channel='CARD' but its stored
-- xendit_payment_request_id resolves (via Xendit's API) to a genuine GCASH
-- ewallet payment_request.
--
-- Fix: the reuse SELECT now also requires payment_channel = p_channel_code,
-- so a channel switch always starts a fresh attempt instead of relabeling an
-- old one. No signature change (CREATE OR REPLACE only); no grant change.
--
-- ROLLBACK: restore the previous body from
-- 20260914065034_xendit_cancelled_order_guard.sql (drop the
-- "and payment_channel = p_channel_code" line from the reuse query).
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

  -- Idempotent reuse: an in-flight or still-valid attempt for the SAME
  -- channel is returned as-is instead of creating a duplicate. "In-flight" =
  -- reserved but Xendit hasn't acknowledged it yet (xendit_payment_request_id
  -- is null), recent enough to still be a live double-click/retry rather
  -- than an abandoned attempt. "Still-valid" = Xendit acknowledged it and it
  -- hasn't expired yet. A different channel_code never matches here, so
  -- switching payment methods always starts a fresh attempt.
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

commit;
