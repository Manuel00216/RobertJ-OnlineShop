-- =============================================================================
-- Reports & Analytics (Phase 8 / Evolution step 5, resolves TD-5).
--
-- Four read-only SECURITY DEFINER RPCs that aggregate sales/order data DB-side
-- over the EXISTING orders / order_items / payments tables. No new tables, no
-- `reports` table, no changes to any existing table / enum / RLS / trigger.
-- Plus two additive indexes on `orders` to support date-range scans.
--
-- Design notes:
--  * These are DEFINER (like create_order / verify_payment / adjust_stock) so
--    they can aggregate efficiently without the per-row EXISTS that plain-RLS
--    reads of order_items/payments would incur. Because DEFINER bypasses RLS,
--    each function RE-ENFORCES scoping internally, exactly as verify_payment
--    does: a seller sees ONLY their own orders (seller_id = auth.uid()); an
--    admin sees every order, optionally narrowed to one shop via p_shop_id.
--    A seller's p_shop_id argument is ignored (defense in depth) — they can
--    never widen past their own seller_id.
--  * Orders have no shop_id column (see TD-1); admin's per-shop filter maps a
--    shop to its seller(s) via shop_users (1 shop : 1 seller today).
--  * SINGLE DATE AXIS: every metric buckets on `placed_at`, interpreted in
--    Asia/Manila (the business timezone; currency is PHP). Inclusive calendar
--    range [p_from, p_to]: placed_at >= from-midnight-Manila and
--    placed_at < (to+1)-midnight-Manila.
--  * METRIC RULE (consistent across all four RPCs): counts/volume include every
--    order PLACED in range; monetary metrics (revenue) include only the subset
--    with payment_status = 'paid' — the confirmed-revenue source of truth,
--    which covers both COD and QR (payments rows are not summed directly, since
--    a COD order may have zero payment rows and an order may accrue multiple).
--  * COD vs QR split: among paid orders, an order is "QR" if it has a paid
--    payments row with payment_method_type = 'qr_upload', else "COD".
--
-- ROLLBACK:
--   drop function public.report_sales_summary(date, date, uuid);
--   drop function public.report_sales_timeseries(date, date, text, uuid);
--   drop function public.report_order_status_breakdown(date, date, uuid);
--   drop function public.report_top_products(date, date, integer, uuid);
--   drop index if exists public.orders_seller_placed_idx;
--   drop index if exists public.orders_placed_at_idx;
-- =============================================================================

begin;

-- --- Additive indexes (nothing existing covers placed_at) --------------------
create index if not exists orders_seller_placed_idx
  on public.orders (seller_id, placed_at desc);
create index if not exists orders_placed_at_idx
  on public.orders (placed_at desc);

-- --- 1. Sales summary (single KPI row; always exactly one row) ----------------
create or replace function public.report_sales_summary(
  p_from date,
  p_to date,
  p_shop_id uuid default null
)
returns table (
  total_orders bigint,
  paid_orders bigint,
  cancelled_orders bigint,
  revenue_cents bigint,
  units_sold bigint,
  avg_order_value_cents bigint,
  cod_paid_orders bigint,
  qr_paid_orders bigint,
  pending_payment_orders bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  return query
  with scoped as (
    select o.id, o.total_cents, o.order_status, o.payment_status
    from public.orders o
    where o.placed_at >= (p_from::timestamp at time zone 'Asia/Manila')
      and o.placed_at <  ((p_to + 1)::timestamp at time zone 'Asia/Manila')
      and case
            when v_is_admin then (
              p_shop_id is null
              or o.seller_id in (
                select su.user_id from public.shop_users su where su.shop_id = p_shop_id
              )
            )
            else o.seller_id = v_uid
          end
  ),
  agg as (
    select
      count(*)::bigint as total_orders,
      count(*) filter (where s.payment_status = 'paid')::bigint as paid_orders,
      count(*) filter (where s.order_status = 'cancelled')::bigint as cancelled_orders,
      coalesce(sum(s.total_cents) filter (where s.payment_status = 'paid'), 0)::bigint as revenue_cents,
      coalesce(round(avg(s.total_cents) filter (where s.payment_status = 'paid')), 0)::bigint as avg_order_value_cents,
      count(*) filter (where s.payment_status = 'pending')::bigint as pending_payment_orders
    from scoped s
  ),
  units as (
    select coalesce(sum(oi.quantity), 0)::bigint as units_sold
    from public.order_items oi
    where oi.order_id in (select id from scoped)
  ),
  methods as (
    select
      count(*) filter (where not m.is_qr)::bigint as cod_paid_orders,
      count(*) filter (where m.is_qr)::bigint as qr_paid_orders
    from (
      select exists (
        select 1 from public.payments pm
        where pm.order_id = s.id
          and pm.status = 'paid'
          and pm.payment_method_type = 'qr_upload'
      ) as is_qr
      from scoped s
      where s.payment_status = 'paid'
    ) m
  )
  select
    agg.total_orders,
    agg.paid_orders,
    agg.cancelled_orders,
    agg.revenue_cents,
    units.units_sold,
    agg.avg_order_value_cents,
    methods.cod_paid_orders,
    methods.qr_paid_orders,
    agg.pending_payment_orders
  from agg, units, methods;
end;
$$;

revoke all on function public.report_sales_summary(date, date, uuid) from public, anon;
grant execute on function public.report_sales_summary(date, date, uuid) to authenticated;

-- --- 2. Sales time series (one row per non-empty bucket) ----------------------
create or replace function public.report_sales_timeseries(
  p_from date,
  p_to date,
  p_granularity text default 'day',
  p_shop_id uuid default null
)
returns table (
  bucket date,
  order_count bigint,
  revenue_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;
  if p_granularity not in ('day', 'week', 'month') then
    raise exception 'Invalid granularity' using errcode = '22023';
  end if;

  return query
  with scoped as (
    select o.placed_at, o.total_cents, o.payment_status
    from public.orders o
    where o.placed_at >= (p_from::timestamp at time zone 'Asia/Manila')
      and o.placed_at <  ((p_to + 1)::timestamp at time zone 'Asia/Manila')
      and case
            when v_is_admin then (
              p_shop_id is null
              or o.seller_id in (
                select su.user_id from public.shop_users su where su.shop_id = p_shop_id
              )
            )
            else o.seller_id = v_uid
          end
  )
  select
    (date_trunc(p_granularity, (s.placed_at at time zone 'Asia/Manila')))::date as bucket,
    count(*)::bigint as order_count,
    coalesce(sum(s.total_cents) filter (where s.payment_status = 'paid'), 0)::bigint as revenue_cents
  from scoped s
  group by 1
  order by 1;
end;
$$;

revoke all on function public.report_sales_timeseries(date, date, text, uuid) from public, anon;
grant execute on function public.report_sales_timeseries(date, date, text, uuid) to authenticated;

-- --- 3. Order-status breakdown (one row per present status) -------------------
create or replace function public.report_order_status_breakdown(
  p_from date,
  p_to date,
  p_shop_id uuid default null
)
returns table (
  status public.order_status,
  order_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  return query
  select o.order_status, count(*)::bigint
  from public.orders o
  where o.placed_at >= (p_from::timestamp at time zone 'Asia/Manila')
    and o.placed_at <  ((p_to + 1)::timestamp at time zone 'Asia/Manila')
    and case
          when v_is_admin then (
            p_shop_id is null
            or o.seller_id in (
              select su.user_id from public.shop_users su where su.shop_id = p_shop_id
            )
          )
          else o.seller_id = v_uid
        end
  group by o.order_status
  order by o.order_status;
end;
$$;

revoke all on function public.report_order_status_breakdown(date, date, uuid) from public, anon;
grant execute on function public.report_order_status_breakdown(date, date, uuid) to authenticated;

-- --- 4. Top products (by units sold; revenue = paid subset) -------------------
create or replace function public.report_top_products(
  p_from date,
  p_to date,
  p_limit integer default 5,
  p_shop_id uuid default null
)
returns table (
  product_id uuid,
  product_title text,
  units_sold bigint,
  revenue_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  return query
  select
    oi.product_id,
    max(oi.product_title) as product_title,
    sum(oi.quantity)::bigint as units_sold,
    coalesce(sum(oi.subtotal_cents) filter (where o.payment_status = 'paid'), 0)::bigint as revenue_cents
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.placed_at >= (p_from::timestamp at time zone 'Asia/Manila')
    and o.placed_at <  ((p_to + 1)::timestamp at time zone 'Asia/Manila')
    and case
          when v_is_admin then (
            p_shop_id is null
            or o.seller_id in (
              select su.user_id from public.shop_users su where su.shop_id = p_shop_id
            )
          )
          else o.seller_id = v_uid
        end
  group by oi.product_id
  order by units_sold desc, revenue_cents desc
  limit greatest(coalesce(p_limit, 5), 0);
end;
$$;

revoke all on function public.report_top_products(date, date, integer, uuid) from public, anon;
grant execute on function public.report_top_products(date, date, integer, uuid) to authenticated;

commit;
