-- =============================================================================
-- Remove the QR/manual-verification ("Bank Transfer") flow, now replaced by
-- Xendit Online Payment. Historical data is explicitly preserved:
--  * every existing `payments` row with payment_method_type='qr_upload' stays
--    untouched (no UPDATE/DELETE here at all);
--  * the payment-receipts Storage bucket, its objects, and its SELECT policy
--    are untouched — only the buyer-INSERT policy is dropped, so no *new*
--    receipts can be created;
--  * payment_method_type keeps 'qr_upload' (and the older 'card' leftover)
--    as permanent-but-unused values, same accepted limitation already true
--    for 'card' since Postgres enum values cannot be cheaply dropped.
--
-- Guard: verified via a pre-flight query that zero payments rows are
-- currently status='pending' AND payment_method_type='qr_upload' before
-- running this — a mid-flight manual payment would otherwise be silently
-- orphaned by dropping verify_payment. This migration also asserts that
-- guarantee itself so it fails loudly instead of silently if run later
-- against a database where that's no longer true.
--
-- Trigger change: enforce_order_update_rules loses ONLY the carve-out that
-- let a seller flip their own order's payment_status pending->paid/failed
-- directly (it existed solely to back verify_payment). The service-role
-- branch (process_xendit_webhook) and the app.refund_in_progress-gated
-- refund branch (decide_return) are both untouched. A follow-up migration
-- adds a narrowly-scoped COD-collection carve-out back, gated by its own
-- transaction-local flag — not a reopening of this one.
--
-- ROLLBACK: restore submit_qr_payment/verify_payment bodies from
-- 20260821114515_payment_rejection_reason.sql; restore the previous
-- enforce_order_update_rules body from 20260821111309_returns_and_refunds.sql;
-- re-create the storage INSERT policy from 20260806181514_payment_receipts_storage.sql.
-- =============================================================================

begin;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.payments
  where status = 'pending' and payment_method_type = 'qr_upload';

  if v_count > 0 then
    raise exception 'Cannot remove the QR manual-verification flow: % payment(s) are still pending manual verification. Resolve them via verify_payment before running this migration.', v_count;
  end if;
end;
$$;

drop function public.submit_qr_payment(uuid, text);
drop function public.verify_payment(uuid, public.payment_status, text);

create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
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
    raise exception 'Payment status is set by the payment provider only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop policy "buyers upload receipts for their own orders" on storage.objects;

commit;
