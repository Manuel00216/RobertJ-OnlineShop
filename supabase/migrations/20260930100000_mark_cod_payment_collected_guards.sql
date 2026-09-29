-- =============================================================================
-- COD workflow audit fix #1 — mark_cod_payment_collected never verified the
-- order was actually payment_method = 'cod', and never checked order_status
-- at all. A Xendit order can legitimately have zero payment rows (the eager
-- reservation in placeOrderAction is best-effort and can silently fail
-- twice), so the existing "no active xendit payment" guard alone doesn't
-- catch that case — a seller could mark a genuinely-unpaid online order as
-- "paid via COD" with nothing actually collected. Separately, nothing
-- stopped collection from being recorded before the item even shipped,
-- which doesn't match how COD collection actually happens (cash at the
-- door, at delivery).
--
-- Adds two checks, both re-derived inside the RPC itself (never trusted
-- from the caller) per this codebase's established defense-in-depth
-- discipline:
--   1. payment_method must be 'cod'.
--   2. order_status must be 'shipped' or 'delivered' — matches the
--      approved decision (allow at ship-or-deliver, not before).
--
-- Byte-identical to the live definition
-- (20260927135835_shop_member_cod_collection_guard.sql) otherwise — same
-- ownership guard, same active-Xendit-attempt guard (kept as additional
-- defense-in-depth, not redundant: it still protects against a COD order
-- that somehow has a stray xendit payments row), same insert/update shape.
-- =============================================================================

begin;

create or replace function public.mark_cod_payment_collected(p_order_id uuid)
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

  if v_uid <> v_order.seller_id and not public.is_admin() and not public.is_shop_member(v_order.shop_id) then
    raise exception 'You do not have permission to collect this payment'
      using errcode = '42501';
  end if;

  if v_order.payment_method <> 'cod' then
    raise exception 'This order is not a Cash on Delivery order' using errcode = '22023';
  end if;

  if v_order.order_status not in ('shipped', 'delivered') then
    raise exception 'COD payment can only be collected once the order has shipped'
      using errcode = '22023';
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

commit;
