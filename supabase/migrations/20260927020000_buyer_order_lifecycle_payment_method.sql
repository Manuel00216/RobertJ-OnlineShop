-- =============================================================================
-- Xendit payment recovery, step C of F: `buyer_order_lifecycle`'s "to_pay"
-- predicate now reads the durable `orders.payment_method` column (added in
-- 20260927000000, written by `create_order`/`create_order_group` since
-- 20260927010000) instead of inferring online-payment intent from
-- `EXISTS(payments row)`. That inference broke exactly when the thing that
-- would have created the row -- `placeOrderAction`'s eager Xendit
-- reservation -- failed: the order silently fell into 'to_ship' instead of
-- 'to_pay', with no Pay Now button, no Cancel button, and stock never
-- released. This one change, combined with 20260927000000's backfill,
-- resolves the exact live stuck order the audit found
-- (ORD-20260914-000132: payment_method backfilled to 'xendit',
-- payment_status='pending', zero payments rows).
--
-- Precedence (unchanged order, only rule 3's condition changes):
--   1. cancelled       -- order_status = 'cancelled'
--   2. return_refund   -- order_status = 'refunded' OR any return_requests row exists
--   3. to_pay          -- payment_method = 'xendit' AND payment_status IN ('pending','failed')
--   4. to_ship         -- order_status IN ('pending','confirmed','processing')
--   5. to_receive      -- order_status = 'shipped'
--   6. completed       -- order_status = 'delivered'
--
-- `active_payment_channel` is unaffected -- still reads the latest xendit
-- payments row for the order; for an order with zero payments rows it
-- correctly returns null, which `OrderCardActions`'s existing
-- `activePaymentChannel ?? "GCASH"` fallback already handles.
--
-- `security_invoker = true` and the `authenticated`-only grant are
-- unchanged: `payment_method` is no more sensitive than the
-- payments-row-existence signal it replaces, and who may query the view
-- doesn't change.
--
-- ROLLBACK:
--   Restore the previous view body from 20260923000000_buyer_order_lifecycle_view.sql.
-- =============================================================================

begin;

create or replace view public.buyer_order_lifecycle
with (security_invoker = true) as
select
  o.id as order_id,
  o.buyer_id,
  o.placed_at,
  (
    select p.payment_channel
    from public.payments p
    where p.order_id = o.id and p.payment_method_type = 'xendit'
    order by p.created_at desc
    limit 1
  ) as active_payment_channel,
  case
    when o.order_status = 'cancelled' then 'cancelled'
    when o.order_status = 'refunded'
      or exists (select 1 from public.return_requests rr where rr.order_id = o.id)
      then 'return_refund'
    when o.payment_status in ('pending', 'failed')
      and o.payment_method = 'xendit'
      then 'to_pay'
    when o.order_status in ('pending', 'confirmed', 'processing') then 'to_ship'
    when o.order_status = 'shipped' then 'to_receive'
    when o.order_status = 'delivered' then 'completed'
    -- Exhaustive over the order_status enum above; kept as a defensive
    -- fallback rather than raising, so a future enum value degrades to a
    -- visible bucket instead of vanishing from every tab.
    else 'to_ship'
  end as lifecycle_tab
from public.orders o;

comment on view public.buyer_order_lifecycle is
  'Computed, read-only lifecycle bucket per order for the buyer /orders tab bar. Single source of truth for the tab mapping -- do not reimplement this precedence in application code.';

revoke all on public.buyer_order_lifecycle from public, anon;
grant select on public.buyer_order_lifecycle to authenticated;

commit;
