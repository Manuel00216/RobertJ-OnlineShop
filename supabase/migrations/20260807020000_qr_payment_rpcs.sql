-- =============================================================================
-- Payments Module (Phase 7), part 2: the two SECURITY DEFINER RPCs that are
-- the sole write path into `payments` (mirrors `create_order`'s chokepoint
-- philosophy — no direct INSERT/UPDATE grants are opened on the table), plus
-- a narrow fix to `enforce_order_update_rules` so a seller can verify payment
-- on their OWN order (the SAD's target path says "Administrator (or Shop
-- Owner)" manually verifies, not admin-only).
--
-- Design notes:
--  * `submit_qr_payment` — buyer submits a receipt for their own order. Blocks
--    a second submission while one is pending/paid (a prior 'failed' one
--    doesn't block resubmission). Re-prices from `orders.total_cents`, never
--    a client-supplied amount.
--  * `verify_payment` — seller (of that order) or admin marks a pending
--    payment paid/failed. Locks both the `payments` and `orders` rows `for
--    update` before touching either, so the two writes are one transaction,
--    not two independent client-driven statements that could partially fail
--    or race. Only decides a `pending` payment once (no re-deciding).
--  * The trigger fix is a narrow branch INSIDE the existing `payment_status`
--    check, not a widened early-return — widening the early-return would also
--    let a seller rewrite financial fields / order_status in the same
--    statement, a real privilege escalation. This only allows
--    pending → {paid,failed} on the seller's OWN order; refunded/
--    partially_refunded stay admin/webhook-only.
--  * SECURITY DEFINER changes the executing role for grants/RLS, but NOT
--    `auth.uid()` and NOT trigger execution — `verify_payment`'s internal
--    `orders` UPDATE still runs the trigger as the real calling seller, so
--    the trigger fix below is required even though the RPC is DEFINER.
--
-- ROLLBACK:
--   drop function public.submit_qr_payment(uuid, text);
--   drop function public.verify_payment(uuid, public.payment_status);
--   -- restore enforce_order_update_rules's previous body from
--   -- 20260803000100_rls_hardening.sql (the payment_status branch becomes an
--   -- unconditional raise again).
-- =============================================================================

begin;

create or replace function public.submit_qr_payment(
  p_order_id uuid,
  p_receipt_path text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_existing_count int;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'You must be signed in to submit a payment receipt'
      using errcode = '42501';
  end if;

  if p_receipt_path is null or length(trim(p_receipt_path)) = 0 then
    raise exception 'A receipt is required' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to submit a receipt for this order'
      using errcode = '42501';
  end if;

  select count(*) into v_existing_count
  from public.payments
  where order_id = p_order_id
    and status in ('pending', 'paid');

  if v_existing_count > 0 then
    raise exception 'A payment for this order is already pending or paid'
      using errcode = '23505';
  end if;

  insert into public.payments (
    order_id, receipt_path, payment_method_type, amount_cents, currency, status
  ) values (
    p_order_id, p_receipt_path, 'qr_upload', v_order.total_cents, v_order.currency, 'pending'
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.submit_qr_payment(uuid, text) from public, anon;
grant execute on function public.submit_qr_payment(uuid, text) to authenticated;

create or replace function public.verify_payment(
  p_payment_id uuid,
  p_decision public.payment_status
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_payment public.payments;
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'You must be signed in to verify a payment'
      using errcode = '42501';
  end if;

  if p_decision not in ('paid', 'failed') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_order.seller_id and not public.is_admin() then
    raise exception 'You do not have permission to verify this payment'
      using errcode = '42501';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'This payment has already been decided'
      using errcode = '23514';
  end if;

  update public.payments
  set status = p_decision,
      verified_by = v_uid,
      verified_at = now()
  where id = p_payment_id
  returning * into v_payment;

  update public.orders
  set payment_status = p_decision
  where id = v_order.id;

  return v_payment;
end;
$$;

revoke all on function public.verify_payment(uuid, public.payment_status) from public, anon;
grant execute on function public.verify_payment(uuid, public.payment_status) to authenticated;

create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- A null auth.uid() means there is no end-user JWT on this request: the
  -- caller is service_role, a webhook, a cron job, or the SQL editor.
  if v_uid is null or public.is_admin() then
    return new;
  end if;

  -- Immutable financial and identity fields.
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

  -- Only the seller advances fulfilment.
  if new.order_status is distinct from old.order_status
     and v_uid <> old.seller_id
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  -- Payment status is never client-driven, EXCEPT: the seller may move their
  -- own order's payment from pending to paid/failed — this is manual QR
  -- receipt verification (verify_payment RPC), not an arbitrary client write.
  -- Any other payment_status change (webhook/service_role, or admin via the
  -- early return above) still bypasses this function entirely as before.
  if new.payment_status is distinct from old.payment_status then
    if v_uid = old.seller_id
       and old.payment_status = 'pending'
       and new.payment_status in ('paid', 'failed')
    then
      null; -- allowed
    else
      raise exception 'Payment status is set by the payment provider only'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

commit;
