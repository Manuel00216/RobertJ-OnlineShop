-- =============================================================================
-- Harden orders.cancelled_by / orders.cancellation_reason against direct
-- PostgREST writes. enforce_order_update_rules already blocks buyer/seller
-- tampering with financial fields, order_status ownership, and
-- payment_status, but was never extended to guard the two cancellation
-- columns added in 20260924000000_order_cancellation_reason.sql. Today the
-- app only ever writes them from queries.cancelBuyerOrder (hardcoded
-- cancelled_by = 'buyer'), but RLS `with_check` on `orders` only verifies
-- buyer_id -- a buyer hitting PostgREST directly with their own session
-- could otherwise set cancelled_by to 'seller'/'admin' or fabricate a
-- cancellation_reason on their own row.
--
-- New rule (non-admin branch only -- admins already bypass this trigger
-- entirely, same as every other check here): either column may only change
-- as part of the buyer cancelling their own not-yet-cancelled order, and
-- only to cancelled_by = 'buyer'. The seller-cancel path never sets these
-- columns (they stay null by design, per that migration's column comments),
-- so any other actor touching them is rejected outright.
--
-- Additive, CREATE OR REPLACE only, no signature change.
--
-- ROLLBACK:
--   Restore the previous body from
--   20260919000000_xendit_channel_aware_stale_payment_fallback.sql.
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

  if new.cancelled_by is distinct from old.cancelled_by
     or new.cancellation_reason is distinct from old.cancellation_reason
  then
    if not (
      v_uid = old.buyer_id
      and old.order_status <> 'cancelled'
      and new.order_status = 'cancelled'
      and new.cancelled_by = 'buyer'
    ) then
      raise exception 'Cancellation details can only be set by the buyer when cancelling their own order'
        using errcode = '42501';
    end if;
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
