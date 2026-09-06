-- =============================================================================
-- Fix report_sales_summary's COD/QR revenue split, which was binary
-- ("not a paid qr_upload payment" = COD) and would have silently
-- misclassified every Xendit-paid order as COD revenue. Adds a third
-- xendit_paid_orders bucket; qr_paid_orders is kept (not removed) so
-- historical QR-paid orders still report correctly. COD is now resolved the
-- same way for both old and new orders: "the order's paid payments row's
-- method, or COD if it has none" (COD never created a payments row before
-- mark_cod_payment_collected; it still won't unless collected).
--
-- Changes the function's return shape (new output column), which
-- `CREATE OR REPLACE` cannot do for a `RETURNS TABLE` function — drop first.
--
-- ROLLBACK: drop this function; restore the two-bucket version from
-- 20260813135033_20260818000000_reports_analytics_rpcs.sql.
-- =============================================================================

begin;

drop function public.report_sales_summary(date, date, uuid);

create function public.report_sales_summary(
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
  xendit_paid_orders bigint,
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
      count(*) filter (where m.method = 'cod')::bigint as cod_paid_orders,
      count(*) filter (where m.method = 'qr_upload')::bigint as qr_paid_orders,
      count(*) filter (where m.method = 'xendit')::bigint as xendit_paid_orders
    from (
      select coalesce(paid_pm.payment_method_type::text, 'cod') as method
      from scoped s
      left join lateral (
        select pm.payment_method_type
        from public.payments pm
        where pm.order_id = s.id
          and pm.status = 'paid'
        order by pm.created_at desc
        limit 1
      ) paid_pm on true
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
    methods.xendit_paid_orders,
    agg.pending_payment_orders
  from agg, units, methods;
end;
$$;

revoke all on function public.report_sales_summary(date, date, uuid) from public, anon;
grant execute on function public.report_sales_summary(date, date, uuid) to authenticated;

commit;
