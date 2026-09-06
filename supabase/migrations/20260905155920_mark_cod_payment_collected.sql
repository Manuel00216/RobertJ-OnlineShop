-- =============================================================================
-- COD must stay payment_status='pending' from order creation until an
-- authorized user (seller of that order, or admin) explicitly marks the
-- cash as collected. This RPC is the only way that happens, and — like
-- verify_payment before it — writes a real `payments` row so COD collections
-- show up in the same ledger as Xendit payments (payment_method_type='cod'
-- has existed in the enum since day one but was never actually written).
--
-- Trigger: a bare "seller can flip payment_status" condition would reopen
-- the exact self-declare gap the QR-removal migration just closed. Instead
-- this mirrors the existing app.refund_in_progress pattern (decide_return):
-- the RPC sets a transaction-local flag immediately before its own `orders`
-- update, and the trigger's seller carve-out requires that flag. A raw
-- client-side `.update()` by the correct seller, bypassing this RPC, still
-- cannot set payment_status.
--
-- ROLLBACK:
--   drop function public.mark_cod_payment_collected(uuid);
--   -- restore enforce_order_update_rules from
--   -- 20260905155806_remove_qr_manual_verification_flow.sql (no seller carve-out).
-- =============================================================================

begin;

create or replace function public.mark_cod_payment_collected(
  p_order_id uuid
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
  v_active_xendit_count int;
begin
  if v_uid is null then
    raise exception 'You must be signed in to collect a COD payment' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_order.seller_id and not public.is_admin() then
    raise exception 'You do not have permission to collect this payment'
      using errcode = '42501';
  end if;

  if v_order.payment_status <> 'pending' then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  select count(*) into v_active_xendit_count
  from public.payments
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and status in ('pending', 'paid');

  if v_active_xendit_count > 0 then
    raise exception 'This order has an active online payment attempt — cannot mark it as a COD collection'
      using errcode = '22023';
  end if;

  insert into public.payments (
    order_id, payment_method_type, amount_cents, currency, status, verified_by, verified_at
  ) values (
    p_order_id, 'cod', v_order.total_cents, v_order.currency, 'paid', v_uid, now()
  )
  returning * into v_payment;

  perform set_config('app.cod_collection_in_progress', 'true', true);

  update public.orders
  set payment_status = 'paid'
  where id = p_order_id;

  return v_payment;
end;
$$;

revoke all on function public.mark_cod_payment_collected(uuid) from public, anon;
grant execute on function public.mark_cod_payment_collected(uuid) to authenticated;


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
    if v_uid = old.seller_id
       and old.payment_status = 'pending'
       and new.payment_status = 'paid'
       and coalesce(current_setting('app.cod_collection_in_progress', true), 'false') = 'true'
    then
      null; -- allowed: mark_cod_payment_collected only
    else
      raise exception 'Payment status is set by the payment provider only'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

commit;
