-- =============================================================================
-- TD-9 (part 1): auto-expire an abandoned/unpaid online-payment order after
-- 24 hours, releasing the stock create_order decremented at placement time.
-- Approved design: docs/payment-ux-architecture-audit.md §8; findings
-- confirmed by the Orders/Payments/Inventory workflow audit.
--
-- `expire_unpaid_xendit_order` is the sole write path — a thin SECURITY
-- DEFINER RPC that re-derives every precondition itself (still `pending`,
-- still unpaid, still `xendit`, actually 24h past `placed_at`) rather than
-- trusting the caller, exactly like `confirm_order_received`/
-- `mark_cod_payment_collected`. It is called with the SERVICE ROLE client
-- (no user session exists in a cron job), so `enforce_order_update_rules`
-- takes its `v_uid is null` bypass branch — the same branch
-- `process_xendit_webhook` already relies on — and the UPDATE below is the
-- ordinary `order_status = 'cancelled'` transition, so the EXISTING
-- `orders_restock_on_cancel` trigger fires and restocks exactly as it does
-- for a buyer/seller/admin cancellation. No second restock path.
--
-- This RPC only performs the DB-side eligibility check and the cancellation
-- itself — it cannot call Xendit's API. The caller (the extended
-- xendit-reconciliation cron route) is responsible for reconciling with
-- Xendit's real status first (reusing the existing
-- isStaleXenditAttempt/reconcileStaleXenditAttempt building blocks) and only
-- invoking this RPC once that comes back "cleared_for_retry" (genuinely not
-- paid) or there was never a payment attempt to reconcile in the first
-- place — never while Xendit still considers the payment resolvable.
-- =============================================================================

begin;

create or replace function public.expire_unpaid_xendit_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if v_order.payment_method <> 'xendit' then
    raise exception 'Only an unpaid online-payment order can be auto-expired.'
      using errcode = '22023';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'This order has already been paid.' using errcode = '22023';
  end if;
  if v_order.order_status <> 'pending' then
    raise exception 'Only a pending order can be auto-expired.' using errcode = '22023';
  end if;
  if v_order.placed_at > now() - interval '24 hours' then
    raise exception 'This order has not yet reached the abandonment threshold.'
      using errcode = '22023';
  end if;

  update public.orders
  set order_status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Automatically cancelled — online payment was not completed within 24 hours.'
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.expire_unpaid_xendit_order(uuid) to service_role;

commit;
