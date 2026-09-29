-- =============================================================================
-- A fully refunded order now also becomes order_status = 'refunded' — an
-- enum value and a buyer_order_lifecycle view branch that have existed since
-- the original schema/lifecycle-view migrations but were never actually
-- reachable: decide_return and process_xendit_refund_webhook only ever
-- changed payment_status. OrderTimeline's "refunded" display copy and
-- STATUS_LABEL_MAP/STATUS_TONE_MAP already handle this status correctly —
-- this activates them, it adds no new UI.
--
-- Only fires when the payment is now FULLY refunded (v_new_status =
-- 'refunded', not 'partially_refunded') — matches order_status having a
-- single terminal 'refunded' value with no "partially refunded" analogue.
-- Correct for both a whole-order return and multiple item-level returns
-- that sum to the full paid amount.
--
-- Both functions are otherwise byte-identical to their live definitions
-- (supabase/migrations/20260921000000_xendit_refunds.sql) — only the
-- `update public.orders` statement in each success path gains the
-- order_status assignment. Both already run with is_admin()/service_role
-- privileges that bypass enforce_order_update_rules' ownership checks (the
-- same v_uid-is-null-or-is_admin() branch process_xendit_webhook and
-- mark_cod_payment_collected already rely on), so no trigger change is
-- needed for this new column write to be allowed.
-- =============================================================================

begin;

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

  -- p_decision = 'approve'.
  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

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

  if v_payment.payment_method_type <> 'xendit' then
    -- Phase 5A, byte-for-byte: no gateway to call (COD, or a retired
    -- qr_upload/card legacy row) -- admin approval and the refund are the
    -- same atomic event.
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

    update public.payments set status = v_new_status where id = v_payment.id;

    perform set_config('app.refund_in_progress', 'true', true);

    update public.orders
    set payment_status = v_new_status,
        order_status = case when v_new_status = 'refunded' then 'refunded'::public.order_status else order_status end
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
  end if;

  -- Xendit-paid: submit an async refund instead of finalizing immediately.
  -- payments/orders/return_requests status is intentionally NOT changed
  -- here -- process_xendit_refund_webhook is the only thing that can move
  -- this to succeeded/failed, keeping provider confirmation separate from
  -- this internal approval step.
  if v_payment.xendit_payment_request_id is null then
    raise exception 'This payment has no Xendit reference to refund' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.xendit_refunds
    where return_request_id = p_return_id and status = 'pending'
  ) then
    raise exception 'A refund is already being processed for this request' using errcode = '23514';
  end if;

  select coalesce(sum(amount_cents), 0) into v_already_refunded
  from public.xendit_refunds
  where payment_id = v_payment.id and status = 'succeeded';

  v_total_refunded := v_already_refunded + v_refund_amount;

  if v_total_refunded > v_payment.amount_cents then
    raise exception 'This refund would exceed the amount actually paid for this order'
      using errcode = '23514';
  end if;

  insert into public.xendit_refunds (
    return_request_id, payment_id, xendit_payment_request_id, amount_cents, currency, status
  ) values (
    p_return_id, v_payment.id, v_payment.xendit_payment_request_id, v_refund_amount, v_payment.currency, 'pending'
  );

  update public.return_requests
  set admin_decision_note = p_note,
      admin_decided_at = now(),
      admin_decided_by = v_uid
  where id = p_return_id
  returning * into v_request;

  insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
  values (
    v_uid, 'approve_refund', v_request.buyer_id,
    jsonb_build_object(
      'return_id', p_return_id, 'order_id', v_request.order_id,
      'refund_amount_cents', v_refund_amount,
      'status', 'submitted_to_xendit'
    )
  );

  return v_request;
end;
$$;

create or replace function public.process_xendit_refund_webhook(
  p_xendit_refund_id text,
  p_status            text,
  p_failure_code      text,
  p_amount_cents      integer,
  p_raw_payload       jsonb
)
returns public.xendit_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund         public.xendit_refunds;
  v_payment        public.payments;
  v_order          public.orders;
  v_new_status     public.payment_status;
  v_total_refunded integer;
begin
  select * into v_refund from public.xendit_refunds where xendit_refund_id = p_xendit_refund_id for update;

  if not found then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      null, null, null, 'refund', p_status, null, 'unknown_refund_reference', p_raw_payload
    );
    return null;
  end if;

  if v_refund.status <> 'pending' then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'duplicate_or_late', p_raw_payload
    );
    return v_refund;
  end if;

  -- Defensive amount cross-check, same spirit as process_xendit_webhook's
  -- amount-mismatch guard: never silently apply a refund for a different
  -- amount than what was actually submitted.
  if p_amount_cents is not null and p_amount_cents <> 0 and p_amount_cents is distinct from v_refund.amount_cents then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'refund_amount_mismatch', p_raw_payload
    );
    return v_refund;
  end if;

  if p_status = 'SUCCEEDED' then
    select * into v_payment from public.payments where id = v_refund.payment_id for update;
    select * into v_order from public.orders where id = v_payment.order_id for update;

    update public.xendit_refunds
    set status = 'succeeded', raw_response = p_raw_payload
    where id = v_refund.id;

    select coalesce(sum(amount_cents), 0) into v_total_refunded
    from public.xendit_refunds
    where payment_id = v_payment.id and status = 'succeeded';

    -- Defensive only: decide_return already validates this at submission
    -- time, so cumulative should never exceed the paid amount here. Cap at
    -- 'refunded' rather than leave an inconsistent state, and flag it.
    v_new_status := case
      when v_total_refunded < v_payment.amount_cents then 'partially_refunded'::public.payment_status
      else 'refunded'::public.payment_status
    end;

    update public.payments set status = v_new_status where id = v_payment.id;

    perform set_config('app.refund_in_progress', 'true', true);

    update public.orders
    set payment_status = v_new_status,
        order_status = case when v_new_status = 'refunded' then 'refunded'::public.order_status else order_status end
    where id = v_order.id;

    update public.return_requests
    set status = 'refunded',
        refund_amount_cents = v_refund.amount_cents
    where id = v_refund.return_request_id;

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id,
      case when v_total_refunded > v_payment.amount_cents then 'refund_overshoot_anomaly' else 'applied' end,
      p_raw_payload
    );

  elsif p_status in ('FAILED', 'CANCELLED') then
    update public.xendit_refunds
    set status = 'failed', failure_code = p_failure_code, raw_response = p_raw_payload
    where id = v_refund.id;
    -- return_requests/payments/orders intentionally untouched -- still
    -- exactly where they were before this attempt, safe to retry.

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'applied', p_raw_payload
    );
  else
    -- PENDING or an unrecognized status -- never safe to assume an outcome.
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'ignored_transient_status', p_raw_payload
    );
  end if;

  select * into v_refund from public.xendit_refunds where id = v_refund.id;
  return v_refund;
end;
$$;

commit;
