-- =============================================================================
-- Real cancellation-reason capture for buyer-initiated order cancellation.
-- Additive only: two nullable columns, no backfill, no RLS change (both are
-- covered by the existing `orders` row policies — same actors who can already
-- read/update an order can read/write these).
--
-- `cancelled_by` reuses the existing `public.user_role` enum rather than a
-- new one, since its three values (buyer/seller/admin) are exactly the set
-- of actors who can ever move an order to `cancelled`.
-- =============================================================================

begin;

alter table public.orders add column cancellation_reason text null;
alter table public.orders add column cancelled_by public.user_role null;

comment on column public.orders.cancellation_reason is
  'Buyer-supplied reason when they cancel their own order (see cancelOrderAction). Null for seller/admin-initiated cancellations and for orders cancelled before this column existed.';
comment on column public.orders.cancelled_by is
  'Which role actually cancelled the order (buyer/seller/admin). Null until order_status first becomes ''cancelled''.';

commit;
