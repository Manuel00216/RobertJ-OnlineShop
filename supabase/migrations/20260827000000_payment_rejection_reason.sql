-- =============================================================================
-- Payment Rejection Reason (Admin Center Phase 3): completes the existing
-- `payments.failure_reason` column, which has existed since
-- 20260804101743_add_payments.sql and been exposed on the `Payment` domain
-- type ever since, but nothing has ever written to it — `verify_payment`
-- never accepted a reason parameter.
--
-- Design, deliberately narrow:
--  * `p_reason text default null` is a new trailing parameter, which changes
--    `verify_payment`'s signature (Postgres identifies functions by
--    name + argument types, not defaults) — `CREATE OR REPLACE` would add a
--    second 3-arg overload alongside the existing 2-arg one rather than
--    replacing it, silently leaving a reason-less bypass in place. The old
--    signature is explicitly DROPped first, matching the lesson from
--    `request_return`'s earlier evidence_path rename in this same phase.
--  * Required, non-empty only when `p_decision = 'failed'` — the `'paid'`
--    path is completely unaffected (`p_reason` stays optional/ignored),
--    matching the "don't break the existing QR verification flow"
--    requirement.
--  * No new authorization surface: every existing check in this function
--    (signed-in, valid decision, order-seller-or-admin, one-shot
--    pending-only) is unchanged — only the reason requirement and its
--    write are added.
--
-- ROLLBACK:
--   drop function public.verify_payment(uuid, public.payment_status, text);
--   create function public.verify_payment(p_payment_id uuid, p_decision public.payment_status)
--     -- restore the body from 20260806181324_qr_payment_rpcs.sql (no reason handling)
--   revoke all on function public.verify_payment(uuid, public.payment_status) from public, anon;
--   grant execute on function public.verify_payment(uuid, public.payment_status) to authenticated;
-- =============================================================================

begin;

drop function public.verify_payment(uuid, public.payment_status);

create function public.verify_payment(
  p_payment_id uuid,
  p_decision   public.payment_status,
  p_reason     text default null
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
    raise exception 'You must be signed in to verify a payment'
      using errcode = '42501';
  end if;

  if p_decision not in ('paid', 'failed') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  if p_decision = 'failed' then
    if p_reason is null or char_length(trim(p_reason)) = 0 then
      raise exception 'A reason is required when rejecting a payment' using errcode = '22023';
    end if;
    if char_length(p_reason) > 500 then
      raise exception 'Reason is too long' using errcode = '22023';
    end if;
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
      failure_reason = case when p_decision = 'failed' then trim(p_reason) else null end,
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

comment on function public.verify_payment is
  'Seller (of that order) or admin marks a pending payment paid/failed. A reason is required and stored (payments.failure_reason) when rejecting.';

revoke all on function public.verify_payment(uuid, public.payment_status, text) from public, anon;
grant execute on function public.verify_payment(uuid, public.payment_status, text) to authenticated;

commit;
