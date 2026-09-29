-- =============================================================================
-- Buyer "Confirm Received" — a delivered order is not otherwise considered
-- resolved. Adds `orders.buyer_confirmed_received_at` (null until the buyer
-- explicitly confirms) and `confirm_order_received(p_order_id)`, the sole
-- write path (mirrors `mark_cod_payment_collected`'s exact shape: a thin
-- SECURITY DEFINER RPC that re-derives its own authorization rather than
-- trusting the caller).
--
-- Per the "orders columns are buyer-writable via raw PostgREST" trap (any
-- new column on `orders` is writable by buyer/seller/admin unless
-- `enforce_order_update_rules` is extended — see
-- 20260925000000_guard_order_cancellation_attribution.sql's precedent), this
-- also extends that trigger so only the legal transition (buyer's own order,
-- currently `delivered`, null -> now(), exactly once) is ever accepted,
-- regardless of whether it comes through the RPC or a direct API call.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists buyer_confirmed_received_at timestamptz null;

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
     and not public.is_shop_member(old.shop_id)
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if (v_uid = old.seller_id or public.is_shop_member(old.shop_id))
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

  if new.buyer_confirmed_received_at is distinct from old.buyer_confirmed_received_at then
    if v_uid = old.buyer_id
       and old.buyer_confirmed_received_at is null
       and new.buyer_confirmed_received_at is not null
       and old.order_status = 'delivered'
    then
      null; -- legal: buyer confirming receipt of their own delivered order, once
    else
      raise exception 'Receipt can only be confirmed once, by the buyer, on a delivered order'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- confirm_order_received: the sole write path for the column above. Re-derives
-- ownership and the delivered/not-already-confirmed precondition itself
-- rather than trusting the caller — the trigger above is defense-in-depth,
-- not the only guard.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_order_received(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if v_order.order_status <> 'delivered' then
    raise exception 'Only a delivered order can be confirmed received.' using errcode = '22023';
  end if;
  if v_order.buyer_confirmed_received_at is not null then
    raise exception 'This order has already been confirmed received.' using errcode = '22023';
  end if;

  update public.orders
    set buyer_confirmed_received_at = now()
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.confirm_order_received(uuid) to authenticated;

commit;
