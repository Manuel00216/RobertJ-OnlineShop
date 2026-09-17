-- =============================================================================
-- Phase 5A: two smallest-safe fixes from the Phase 5 audit, both additive to
-- the existing returns/refunds state machine (20260826000000, as corrected
-- by 20260826010000's evidence_path rename -- request_return's fourth
-- parameter is p_evidence_path here, matching the live function exactly, not
-- the superseded p_evidence_url from the original migration file). No new
-- table, no new column, no new enum value, no Xendit call, no change to
-- Phase 1-4 payment logic or to paid-order cancellation behavior itself.
--
--  1. request_return: a buyer's order can be cancelled while already paid
--     (existing, unchanged cancellation behavior — see order.actions.ts /
--     cancelBuyerOrder / advanceOrderStatus, none of which are touched here),
--     and today that leaves the payment permanently unreachable by any
--     refund path: request_return required order_status = 'delivered'. Fixed
--     by widening its precondition to also accept a cancelled order that was
--     already paid at cancellation time. An unpaid cancelled order (the
--     ordinary case) is still rejected exactly as before.
--
--  2. decide_return: approving a return already computed the correct refund
--     amount (order total for a whole-order return, an item's own
--     subtotal_cents for an item-level one -- UNCHANGED, this migration does
--     not touch that computation), but then unconditionally set
--     payments.status/orders.payment_status to 'refunded' regardless of
--     whether the amount actually covered the whole payment. Fixed to:
--       - sum the buyer's already-completed refund_amount_cents for this
--         order (from prior return_requests rows), so a second item's refund
--         on the same order is judged against what's actually left, not
--         against the original full amount again
--       - reject a refund that would exceed the amount actually paid (an
--         over-refund guard; the original never had this check because it
--         never needed one -- there was never a second successful refund
--         possible before this fix)
--       - set 'partially_refunded' when the cumulative refunded amount is
--         still less than the payment's full amount, 'refunded' only once it
--         reaches it -- for both payments.status and orders.payment_status,
--         mirroring the same dual-write shape the original body already used
--     This also fixes the compounding bug where a correct partial refund
--     made every later refund on that order impossible: decide_return's
--     payment lookup only matched status = 'paid', so once a payment turned
--     'refunded' (even though only partially covered), no further refund
--     could ever find it. Now the lookup also matches 'partially_refunded'.
--
-- Deliberately NOT changed: no Xendit refund call, no refund webhook, no new
-- payment_status/return_status value, no change to request_return's
-- authorization/ownership checks, no change to respond_to_return, no change
-- to cancelBuyerOrder/advanceOrderStatus/enforce_order_update_rules, no
-- change to COD's own path (mark_cod_payment_collected is untouched --
-- decide_return already treated every payment_method_type identically, and
-- still does).
--
-- ROLLBACK:
--   Restore request_return from 20260826010000_return_requests_evidence_path_fix.sql
--   and decide_return from 20260826000000_returns_and_refunds.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- request_return: additive precondition widening only. Everything else
-- (auth check, reason validation, item ownership check, duplicate-open-
-- request guard, insert, and the p_evidence_path parameter/column from
-- 20260826010000) is byte-for-byte unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.request_return(
  p_order_id      uuid,
  p_order_item_id uuid default null,
  p_reason        text default null,
  p_evidence_path text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
  v_request public.return_requests;
begin
  if v_uid is null then
    raise exception 'You must be signed in to request a return' using errcode = '42501';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to request a return for this order'
      using errcode = '42501';
  end if;

  -- Phase 5A: a delivered order can always be returned, unchanged. A
  -- cancelled order can only be returned if it was already paid -- an
  -- unpaid cancelled order (the ordinary case) has nothing to refund and is
  -- still rejected exactly as before.
  if not (
    v_order.order_status = 'delivered'
    or (v_order.order_status = 'cancelled' and v_order.payment_status = 'paid')
  ) then
    raise exception 'Only a delivered order, or a cancelled order that was already paid, can be returned'
      using errcode = '22023';
  end if;

  if p_order_item_id is not null then
    if not exists (
      select 1 from public.order_items
      where id = p_order_item_id and order_id = p_order_id
    ) then
      raise exception 'This item does not belong to this order' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id
      and coalesce(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status in ('pending', 'seller_accepted')
  ) then
    raise exception 'A return request is already open for this order' using errcode = '23514';
  end if;

  insert into public.return_requests (
    order_id, order_item_id, buyer_id, seller_id, reason, evidence_path
  )
  values (
    p_order_id, p_order_item_id, v_uid, v_order.seller_id, trim(p_reason), p_evidence_path
  )
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.request_return is
  'Buyer-only: opens a return/refund request for a delivered order, or a cancelled order that was already paid. DB-enforced duplicate guard via return_requests_one_open_per_order_item.';


-- -----------------------------------------------------------------------------
-- decide_return: reject path is byte-for-byte unchanged. Approve path keeps
-- the exact same refund-amount computation (order total / item subtotal),
-- adds a cumulative-already-refunded lookup and an over-refund guard, and
-- branches the payment_status write between 'partially_refunded' and
-- 'refunded' instead of always 'refunded'.
-- -----------------------------------------------------------------------------
create or replace function public.decide_return(
  p_return_id uuid,
  p_decision  text,
  p_note      text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := (select auth.uid());
  v_request          public.return_requests;
  v_order            public.orders;
  v_payment          public.payments;
  v_refund_amount    integer;
  v_already_refunded integer;
  v_total_refunded   integer;
  v_new_status       public.payment_status;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to decide a return request'
      using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found' using errcode = 'P0002';
  end if;

  if v_request.status not in ('seller_accepted', 'seller_rejected') then
    raise exception 'This return request is not ready for a final decision'
      using errcode = '23514';
  end if;

  if p_decision = 'reject' then
    update public.return_requests
    set status = 'admin_rejected',
        admin_decision_note = p_note,
        admin_decided_at = now(),
        admin_decided_by = v_uid
    where id = p_return_id
    returning * into v_request;

    insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
    values (
      v_uid, 'reject_refund', v_request.buyer_id,
      jsonb_build_object('return_id', p_return_id, 'order_id', v_request.order_id)
    );

    return v_request;
  end if;

  -- p_decision = 'approve': execute the refund now.
  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  -- Phase 5A: also matches a payment already partially refunded, so a
  -- second (or later) item's refund on the same order can still be
  -- processed -- previously only 'paid' matched, so one partial refund
  -- permanently blocked every subsequent refund on that order.
  select * into v_payment
  from public.payments
  where order_id = v_request.order_id and status in ('paid', 'partially_refunded')
  for update;
  if not found then
    raise exception 'No paid payment found for this order' using errcode = '23514';
  end if;

  -- Unchanged: order total for a whole-order return, that item's own
  -- subtotal_cents for an item-level one.
  if v_request.order_item_id is null then
    v_refund_amount := v_order.total_cents;
  else
    select subtotal_cents into v_refund_amount
    from public.order_items
    where id = v_request.order_item_id;
  end if;

  -- Phase 5A: how much of this payment has already been refunded by prior
  -- completed requests on this same order (excludes this row -- it hasn't
  -- reached 'refunded' yet).
  select coalesce(sum(refund_amount_cents), 0) into v_already_refunded
  from public.return_requests
  where order_id = v_request.order_id and status = 'refunded';

  v_total_refunded := v_already_refunded + v_refund_amount;

  if v_total_refunded > v_payment.amount_cents then
    raise exception 'This refund would exceed the amount actually paid for this order'
      using errcode = '23514';
  end if;

  v_new_status := case
    when v_total_refunded < v_payment.amount_cents then 'partially_refunded'::public.payment_status
    else 'refunded'::public.payment_status
  end;

  update public.payments
  set status = v_new_status
  where id = v_payment.id;

  -- Transaction-local flag: the only way enforce_order_update_rules allows
  -- payment_status to become refunded/partially_refunded, unchanged from
  -- the original.
  perform set_config('app.refund_in_progress', 'true', true);

  update public.orders
  set payment_status = v_new_status
  where id = v_order.id;

  update public.return_requests
  set status = 'refunded',
      admin_decision_note = p_note,
      admin_decided_at = now(),
      admin_decided_by = v_uid,
      refund_amount_cents = v_refund_amount
  where id = p_return_id
  returning * into v_request;

  insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
  values (
    v_uid, 'approve_refund', v_request.buyer_id,
    jsonb_build_object(
      'return_id', p_return_id, 'order_id', v_request.order_id,
      'refund_amount_cents', v_refund_amount,
      'payment_status', v_new_status
    )
  );

  return v_request;
end;
$$;

comment on function public.decide_return is
  'Admin-only: approves (executes the refund) or rejects a return request already responded to by its seller. Only valid from seller_accepted/seller_rejected. Approving sets partially_refunded or refunded depending on whether the cumulative refunded amount covers the full payment; a second partial refund on the same order is allowed as long as it does not exceed what was actually paid.';

commit;
