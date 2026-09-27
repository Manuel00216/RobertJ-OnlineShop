-- =============================================================================
-- RPC updates: (a) create_order stamps orders.shop_id from the product being
-- purchased; (b) record_order_shipment / respond_to_return widen their
-- explicit in-function authorization guards to accept a shop member, not
-- just the literal seller_id; (c) report_* RPCs' seller-caller branch scopes
-- by the caller's current shop (falling back to seller_id for legacy
-- null-shop-id orders) instead of only the caller's own seller_id.
--
-- No signature changes on any function — CREATE OR REPLACE is safe in place
-- (no DROP needed; see project precedent on ambiguous-overload risk when
-- parameter lists change, which does NOT apply here).
--
-- seller_id / buyer_id columns are NEVER rewritten by this migration —
-- shop_id is stamped as a NEW, additional column value only.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- create_order: stamp orders.shop_id from the purchased product's shop_id.
-- Body is byte-identical to the live definition except the declared
-- v_shop_id variable, capturing it once in the pricing loop, and adding it
-- to the orders INSERT column/value list.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_seller_id           uuid,
  p_items               jsonb,
  p_shipping_address    jsonb,
  p_shipping_fee_cents  integer default 0,
  p_notes               text default null,
  p_checkout_group_id   uuid default null,
  p_payment_method      text default 'cod'
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id      uuid := (select auth.uid());
  v_order         public.orders;
  v_item          jsonb;
  v_product       public.products;
  v_variant       public.product_variants;
  v_variant_id    uuid;
  v_variant_label text;
  v_inventory     public.inventory;
  v_quantity      integer;
  v_unit_price    integer;
  v_subtotal      integer := 0;
  v_currency      char(3);
  v_shop_id       uuid;
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_buyer_id = p_seller_id then
    raise exception 'You cannot buy your own listing' using errcode = '22023';
  end if;

  if public.current_user_role() <> 'buyer' then
    raise exception 'Only buyers can place orders' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required' using errcode = '22023';
  end if;

  if p_shipping_fee_cents < 0 then
    raise exception 'Shipping fee cannot be negative' using errcode = '22023';
  end if;

  if p_payment_method not in ('cod', 'xendit') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_seller_id and is_active
  ) then
    raise exception 'This seller is not currently accepting orders'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::integer;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be a positive integer'
        using errcode = '22023';
    end if;

    v_variant := null;
    if v_variant_id is not null then
      select * into v_variant
      from public.product_variants
      where id = v_variant_id;

      if not found or v_variant.product_id <> (v_item ->> 'product_id')::uuid then
        raise exception 'Selected option is no longer available' using errcode = '23503';
      end if;
    end if;

    if v_variant_id is not null then
      select * into v_inventory
      from public.inventory
      where variant_id = v_variant_id
      for update;
    else
      select * into v_inventory
      from public.inventory
      where product_id = (v_item ->> 'product_id')::uuid and variant_id is null
      for update;
    end if;

    if not found then
      raise exception 'Product % not found', v_item ->> 'product_id'
        using errcode = '23503';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
    for update;

    if not found then
      raise exception 'Product % not found', v_item ->> 'product_id'
        using errcode = '23503';
    end if;

    if v_product.status <> 'active' then
      raise exception 'Product % is not available', v_product.title
        using errcode = '22023';
    end if;

    if v_variant_id is not null and v_variant.status <> 'active' then
      raise exception '% is not available', v_product.title
        using errcode = '22023';
    end if;

    if v_product.seller_id <> p_seller_id then
      raise exception 'All items in an order must belong to one seller'
        using errcode = '22023';
    end if;

    if v_inventory.quantity < v_quantity then
      raise exception 'Only % left of %', v_inventory.quantity, v_product.title
        using errcode = '23514';
    end if;

    if v_currency is null then
      v_currency := v_product.currency;
    elsif v_currency <> v_product.currency then
      raise exception 'All items in an order must share one currency'
        using errcode = '22023';
    end if;

    if v_shop_id is null then
      v_shop_id := v_product.shop_id;
    end if;

    v_unit_price := v_product.price_cents;
    if v_variant_id is not null and v_variant.price_cents is not null then
      v_unit_price := v_variant.price_cents;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  insert into public.orders (
    buyer_id, seller_id, shop_id, subtotal_cents, shipping_fee_cents, total_cents,
    currency, shipping_address, notes, checkout_group_id, payment_method
  )
  values (
    v_buyer_id, p_seller_id, v_shop_id, v_subtotal, p_shipping_fee_cents,
    v_subtotal + p_shipping_fee_cents, v_currency, p_shipping_address, p_notes,
    p_checkout_group_id, p_payment_method::public.order_payment_method
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::integer;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid;

    v_unit_price := v_product.price_cents;
    v_variant_label := null;
    v_variant := null;
    if v_variant_id is not null then
      select * into v_variant
      from public.product_variants
      where id = v_variant_id;

      if v_variant.price_cents is not null then
        v_unit_price := v_variant.price_cents;
      end if;
      v_variant_label := nullif(trim(concat_ws(' / ', v_variant.color, v_variant.size)), '');
    end if;

    insert into public.order_items (
      order_id, product_id, product_title, quantity,
      unit_price_cents, subtotal_cents, variant_id, variant_label
    )
    values (
      v_order.id, v_product.id, v_product.title, v_quantity,
      v_unit_price, v_unit_price * v_quantity, v_variant_id, v_variant_label
    );

    if v_variant_id is not null then
      select * into v_inventory
      from public.inventory
      where variant_id = v_variant_id;
    else
      select * into v_inventory
      from public.inventory
      where product_id = v_product.id and variant_id is null;
    end if;

    update public.inventory
    set quantity = v_inventory.quantity - v_quantity
    where id = v_inventory.id;

    insert into public.stock_adjustments (
      product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
      reason, note, related_order_id, created_by
    )
    values (
      v_product.id, v_variant_id, v_product.shop_id, -v_quantity, v_inventory.quantity,
      v_inventory.quantity - v_quantity, 'sale', 'Order ' || v_order.order_number,
      v_order.id, null
    );
  end loop;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_order_shipment: widen the explicit guard to accept a shop member;
-- stamp shop_id from the order.
-- ---------------------------------------------------------------------------
create or replace function public.record_order_shipment(
  p_order_id        uuid,
  p_courier         text,
  p_tracking_number text
)
returns public.order_shipments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_order    public.orders;
  v_shipment public.order_shipments;
begin
  if v_uid is null then
    raise exception 'You must be signed in to ship an order' using errcode = '42501';
  end if;

  if p_courier is null or char_length(trim(p_courier)) = 0 then
    raise exception 'A courier is required' using errcode = '22023';
  end if;
  if char_length(trim(p_courier)) > 80 then
    raise exception 'Courier name is too long' using errcode = '22023';
  end if;
  if p_tracking_number is null or char_length(trim(p_tracking_number)) = 0 then
    raise exception 'A tracking number is required' using errcode = '22023';
  end if;
  if char_length(trim(p_tracking_number)) > 120 then
    raise exception 'Tracking number is too long' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if not (public.is_admin() or v_order.seller_id = v_uid or public.is_shop_member(v_order.shop_id)) then
    raise exception 'You do not have permission to ship this order' using errcode = '42501';
  end if;

  if v_order.order_status <> 'processing' then
    raise exception 'Only an order that is ready for pickup can be marked shipped'
      using errcode = '22023';
  end if;

  if v_order.payment_status <> 'paid' and exists (
    select 1 from public.payments
    where order_id = p_order_id and payment_method_type = 'xendit'
  ) then
    raise exception 'This order''s online payment hasn''t been completed yet. It can''t be shipped until the payment succeeds.'
      using errcode = '22023';
  end if;

  insert into public.order_shipments (order_id, seller_id, shop_id, courier, tracking_number)
  values (p_order_id, v_order.seller_id, v_order.shop_id, trim(p_courier), trim(p_tracking_number))
  on conflict (order_id) do update
    set courier = excluded.courier,
        tracking_number = excluded.tracking_number,
        updated_at = now()
  returning * into v_shipment;

  update public.orders
    set order_status = 'shipped'
    where id = p_order_id;

  return v_shipment;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_return: stamp shop_id from the order. Guard is buyer-only,
-- unaffected. Signature/body otherwise byte-identical to the live definition
-- (p_evidence_path, delivered-or-paid-cancelled eligibility).
-- ---------------------------------------------------------------------------
create or replace function public.request_return(
  p_order_id      uuid,
  p_order_item_id uuid default null,
  p_reason        text default null,
  p_evidence_path text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
  v_request public.return_requests;
begin
  if v_uid is null then
    raise exception 'You must be signed in to request a return' using errcode = '42501';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to request a return for this order'
      using errcode = '42501';
  end if;

  if not (
    v_order.order_status = 'delivered'
    or (v_order.order_status = 'cancelled' and v_order.payment_status = 'paid')
  ) then
    raise exception 'Only a delivered order, or a cancelled order that was already paid, can be returned'
      using errcode = '22023';
  end if;

  if p_order_item_id is not null then
    if not exists (
      select 1 from public.order_items
      where id = p_order_item_id and order_id = p_order_id
    ) then
      raise exception 'This item does not belong to this order' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id
      and coalesce(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status in ('pending', 'seller_accepted')
  ) then
    raise exception 'A return request is already open for this order' using errcode = '23514';
  end if;

  insert into public.return_requests (
    order_id, order_item_id, buyer_id, seller_id, shop_id, reason, evidence_path
  )
  values (
    p_order_id, p_order_item_id, v_uid, v_order.seller_id, v_order.shop_id, trim(p_reason), p_evidence_path
  )
  returning * into v_request;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_return: widen the explicit guard to accept a shop member.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_return(
  p_return_id uuid,
  p_decision  text,
  p_note      text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_request public.return_requests;
begin
  if v_uid is null then
    raise exception 'You must be signed in to respond to a return request'
      using errcode = '42501';
  end if;

  if p_decision not in ('accept', 'reject') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_request.seller_id
     and not public.is_admin()
     and not public.is_shop_member(v_request.shop_id) then
    raise exception 'You do not have permission to respond to this return request'
      using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This return request has already been responded to'
      using errcode = '23514';
  end if;

  update public.return_requests
  set status = case when p_decision = 'accept' then 'seller_accepted' else 'seller_rejected' end,
      seller_decision_note = p_note,
      seller_decided_at = now(),
      seller_decided_by = v_uid
  where id = p_return_id
  returning * into v_request;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_* : the seller-caller branch now scopes by the caller's CURRENT
-- shop (all of the shop's orders, past and present), falling back to the
-- caller's own seller_id only for legacy orders with no resolvable shop_id
-- (the 5 orders left NULL by this phase's backfill). Admin branch is
-- UNCHANGED. No signature change.
-- ---------------------------------------------------------------------------
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
  v_caller_shop_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  if not v_is_admin then
    select su.shop_id into v_caller_shop_id from public.shop_users su where su.user_id = v_uid;
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
            else (
              (v_caller_shop_id is not null and o.shop_id = v_caller_shop_id)
              or (o.shop_id is null and o.seller_id = v_uid)
            )
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
  v_caller_shop_id uuid;
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

  if not v_is_admin then
    select su.shop_id into v_caller_shop_id from public.shop_users su where su.user_id = v_uid;
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
            else (
              (v_caller_shop_id is not null and o.shop_id = v_caller_shop_id)
              or (o.shop_id is null and o.seller_id = v_uid)
            )
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

create or replace function public.report_order_status_breakdown(
  p_from date,
  p_to date,
  p_shop_id uuid default null
)
returns table (
  status order_status,
  order_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
  v_caller_shop_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  if not v_is_admin then
    select su.shop_id into v_caller_shop_id from public.shop_users su where su.user_id = v_uid;
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
          else (
            (v_caller_shop_id is not null and o.shop_id = v_caller_shop_id)
            or (o.shop_id is null and o.seller_id = v_uid)
          )
        end
  group by o.order_status
  order by o.order_status;
end;
$$;

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
  v_caller_shop_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to view reports' using errcode = '42501';
  end if;
  if not (v_is_admin or public.current_user_role() = 'seller') then
    raise exception 'You do not have permission to view reports' using errcode = '42501';
  end if;

  if not v_is_admin then
    select su.shop_id into v_caller_shop_id from public.shop_users su where su.user_id = v_uid;
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
          else (
            (v_caller_shop_id is not null and o.shop_id = v_caller_shop_id)
            or (o.shop_id is null and o.seller_id = v_uid)
          )
        end
  group by oi.product_id
  order by units_sold desc, revenue_cents desc
  limit greatest(coalesce(p_limit, 5), 0);
end;
$$;

commit;
