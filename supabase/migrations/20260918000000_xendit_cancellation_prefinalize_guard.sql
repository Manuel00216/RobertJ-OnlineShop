-- =============================================================================
-- Phase 3 fix #3 (narrow scope): close the pre-finalize cancellation window.
--
-- `enforce_order_update_rules()`'s "active Xendit payment" cancellation guard
-- only matched a payment row once `xendit_payment_request_id` was set (i.e.
-- after `finalize_xendit_payment_request` / `finalize_xendit_group_payment_
-- request` ran). Between `begin_xendit_payment_attempt` /
-- `begin_xendit_group_payment_attempt` inserting the row (request id still
-- null) and finalize populating it -- the round trip to Xendit's API -- an
-- order could be cancelled even though a payment attempt was actively being
-- created for it.
--
-- This did NOT allow a cancelled order to become paid: `process_xendit_
-- webhook` independently re-checks `order_status = 'cancelled'` at
-- processing time (after taking its own row lock) and safely no-ops with a
-- `payment_webhook_events` entry (`processing_result = 'order_cancelled'`)
-- either way. That safety net is untouched by this migration. This fix only
-- closes the narrow window where cancellation itself was wrongly allowed to
-- proceed while a payment attempt was in flight.
--
-- Fix: widen the guard's "active" definition to match the exact in-flight
-- window convention already established (and trusted) by
-- `begin_xendit_payment_attempt` / `begin_xendit_group_payment_attempt`'s own
-- idempotent-reuse checks:
--   (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
--   or (xendit_payment_request_id is not null and (expires_at is null or expires_at > now()))
--
-- Everything else in the function -- the refund guard, financial-field
-- immutability, fulfilment-status ownership, payment_status provider-only
-- rule, COD-collection escape hatch -- is byte-for-byte unchanged.
--
-- ROLLBACK:
--   Restore the previous body from
--   20260914132906_xendit_phase2_multiseller_group_payment.sql.
-- =============================================================================

begin;

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
          or (p.xendit_payment_request_id is not null and (p.expires_at is null or p.expires_at > now()))
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
