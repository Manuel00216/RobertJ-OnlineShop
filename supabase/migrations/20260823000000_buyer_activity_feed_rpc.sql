-- =============================================================================
-- get_buyer_activity_feed() (Buyer UX Improvement Phase — see DECISIONS.md
-- ADR-018): a derived, read-only notification feed. No new table, no
-- triggers, no Supabase Realtime — it unions timestamps that already exist
-- on `orders`/`payments`, exactly the same "read-only SECURITY DEFINER RPC
-- over existing tables" shape as the `report_*` RPCs
-- (20260818000000_reports_analytics_rpcs.sql).
--
-- Deliberately omits "order confirmed" / "processing" as discrete events:
-- `orders` only auto-stamps `paid_at`/`shipped_at`/`delivered_at`/
-- `cancelled_at` (see `track_order_status_timestamps`, initial_schema.sql) —
-- there is no `confirmed_at`/`processing_at` column, so representing those
-- transitions would mean guessing a timestamp rather than reporting one.
--
-- `create_order`, `verify_payment`, `submit_qr_payment`,
-- `enforce_order_update_rules`, and `track_order_status_timestamps` are not
-- touched by this migration.
--
-- ROLLBACK:
--   drop function public.get_buyer_activity_feed(integer);
-- =============================================================================

begin;

create or replace function public.get_buyer_activity_feed(p_limit integer default 20)
returns table (
  event_type text,
  order_id uuid,
  order_number text,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select event_type, order_id, order_number, occurred_at
  from (
    select 'order_placed'::text as event_type, o.id as order_id,
           o.order_number, o.placed_at as occurred_at
    from public.orders o
    where o.buyer_id = (select auth.uid())

    union all

    select 'payment_confirmed'::text, o.id, o.order_number, o.paid_at
    from public.orders o
    where o.buyer_id = (select auth.uid()) and o.paid_at is not null

    union all

    select 'order_shipped'::text, o.id, o.order_number, o.shipped_at
    from public.orders o
    where o.buyer_id = (select auth.uid()) and o.shipped_at is not null

    union all

    select 'order_delivered'::text, o.id, o.order_number, o.delivered_at
    from public.orders o
    where o.buyer_id = (select auth.uid()) and o.delivered_at is not null

    union all

    select 'order_cancelled'::text, o.id, o.order_number, o.cancelled_at
    from public.orders o
    where o.buyer_id = (select auth.uid()) and o.cancelled_at is not null

    union all

    select 'receipt_submitted'::text, o.id, o.order_number, p.created_at
    from public.payments p
    join public.orders o on o.id = p.order_id
    where o.buyer_id = (select auth.uid())

    union all

    select
      case when p.status = 'paid' then 'payment_verified' else 'payment_failed' end,
      o.id, o.order_number, p.verified_at
    from public.payments p
    join public.orders o on o.id = p.order_id
    where o.buyer_id = (select auth.uid()) and p.verified_at is not null
  ) events
  order by occurred_at desc
  limit greatest(p_limit, 0);
$$;

-- This project grants a default PUBLIC=EXECUTE on new functions, inherited
-- directly by `anon` (not just via `public`) — see
-- 20260822010000_revoke_submit_review_anon_execute.sql for the same gap on
-- submit_review. Revoke both explicitly from the start this time.
revoke execute on function public.get_buyer_activity_feed(integer)
  from public, anon;

grant execute on function public.get_buyer_activity_feed(integer)
  to authenticated;

commit;
