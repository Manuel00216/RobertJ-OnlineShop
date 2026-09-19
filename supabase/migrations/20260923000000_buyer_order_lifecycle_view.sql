-- =============================================================================
-- Buyer order lifecycle view: single source of truth for the Shopee-style
-- /orders tabs (All, To Pay, To Ship, To Receive, Completed, Cancelled,
-- Return/Refund). Additive only — no ALTER TABLE, no backfill, no RPC
-- signature changes. Explicitly `security_invoker = true` (PG15+): without
-- it, a Postgres view runs as its owner (in Supabase, typically a role that
-- bypasses RLS) and would silently leak every buyer's orders to any
-- authenticated caller. With it, the view inherits the *querying* user's
-- existing RLS on orders/payments/return_requests — same boundary as
-- querying `orders` directly.
--
-- Precedence (an order lands in exactly one bucket):
--   1. cancelled       — order_status = 'cancelled'
--   2. return_refund   — order_status = 'refunded' OR any return_requests row exists
--   3. to_pay          — has a payments row (payment_method_type='xendit')
--                        AND payment_status IN ('pending','failed')
--   4. to_ship         — order_status IN ('pending','confirmed','processing')
--   5. to_receive      — order_status = 'shipped'
--   6. completed       — order_status = 'delivered'
--
-- `active_payment_channel` (GCASH/PAYMAYA/CARD/null) is the order's most
-- recent Xendit attempt's channel — lets the buyer-facing "To Pay" order
-- card decide between "Complete your Card Payment" and "Pay Now"/"Payment
-- Failed" without a separate per-order query (avoids N+1 on the list page).
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
      and exists (
        select 1 from public.payments p
        where p.order_id = o.id and p.payment_method_type = 'xendit'
      )
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
  'Computed, read-only lifecycle bucket per order for the buyer /orders tab bar. Single source of truth for the tab mapping — do not reimplement this precedence in application code.';

revoke all on public.buyer_order_lifecycle from public, anon;
grant select on public.buyer_order_lifecycle to authenticated;

commit;
