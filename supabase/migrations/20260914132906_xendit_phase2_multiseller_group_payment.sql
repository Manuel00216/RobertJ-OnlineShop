-- =============================================================================
-- Phase 2: multi-seller checkout, one combined Xendit payment.
-- One order per seller (unchanged) correlated by a server/database-generated
-- checkout_group_id; one payment row per order (unchanged shape), also
-- correlated by checkout_group_id, funded by one shared Xendit charge.
-- Single-order Xendit flow (begin_xendit_payment_attempt /
-- finalize_xendit_payment_request) is untouched. process_xendit_webhook's
-- existing single-payment path is preserved byte-for-byte as the fallback
-- when no checkout_group_id matches. COD, RLS, and reporting are untouched.
-- Client never supplies order ids, the group id, or an amount -- all
-- resolved/computed server-side from locked rows.
-- =============================================================================

begin;

alter table public.orders   add column checkout_group_id uuid null;
alter table public.payments add column checkout_group_id uuid null;

create index orders_checkout_group_id_idx
  on public.orders (checkout_group_id) where checkout_group_id is not null;
create index payments_checkout_group_id_idx
  on public.payments (checkout_group_id) where checkout_group_id is not null;

comment on column public.orders.checkout_group_id is
  'Correlates sibling orders (one per seller) created together from one multi-seller checkout, sharing one combined Xendit payment. Null for COD and single-seller checkouts.';
comment on column public.payments.checkout_group_id is
  'Correlates sibling payment rows (one per order) funded by one combined Xendit charge. Set only by begin_xendit_group_payment_attempt.';

-- Relax so N sibling payment rows (one per order) can share one Xendit id;
-- an order can still never be double-assigned the same Xendit id.
alter table public.payments drop constraint payments_xendit_payment_request_id_key;
alter table public.payments add constraint payments_xendit_payment_request_id_key
  unique (xendit_payment_request_id, order_id);

alter table public.payments drop constraint payments_xendit_payment_id_key;
alter table public.payments add constraint payments_xendit_payment_id_key
  unique (xendit_payment_id, order_id);

-- create_order gains a new trailing defaulted parameter. Adding a parameter
-- via CREATE OR REPLACE creates a SECOND overload rather than replacing the
-- original -- confirmed by dry-run -- so the old 5-arg signature is dropped
-- explicitly first, matching this project's own established pattern for
-- RPC signature changes (see 20260905162555_xendit_rpc_optional_params_fixed.sql).
drop function public.create_order(uuid, jsonb, jsonb, integer, text);

create or replace function public.create_order(
  p_seller_id          uuid,
  p_items              jsonb,
  p_shipping_address   jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes              text default null,
  p_checkout_group_id  uuid default null
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
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_buyer_id = p_seller_id then
    raise exception 'You cannot buy your own listing' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required' using errcode = '22023';
  end if;

  if p_shipping_fee_cents < 0 then
    raise exception 'Shipping fee cannot be negative' using errcode = '22023';
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

    v_unit_price := v_product.price_cents;
    if v_variant_id is not null and v_variant.price_cents is not null then
      v_unit_price := v_variant.price_cents;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  insert into public.orders (
    buyer_id, seller_id, subtotal_cents, shipping_fee_cents, total_cents,
    currency, shipping_address, notes, checkout_group_id
  )
  values (
    v_buyer_id, p_seller_id, v_subtotal, p_shipping_fee_cents,
    v_subtotal + p_shipping_fee_cents, v_currency, p_shipping_address, p_notes,
    p_checkout_group_id
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

-- New: mints checkout_group_id server-side (gen_random_uuid()), inside the
-- database, before the client ever sees it. Reuses create_order's existing,
-- unmodified logic once per seller group -- no duplicated validation logic.
-- All-or-nothing: any per-seller failure rolls back every order in the batch.
create or replace function public.create_order_group(
  p_groups             jsonb,
  p_shipping_address   jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes              text default null
)
returns setof public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid := gen_random_uuid();
  v_group    jsonb;
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'At least one seller group is required' using errcode = '22023';
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    return next public.create_order(
      p_seller_id          := (v_group ->> 'seller_id')::uuid,
      p_items              := v_group -> 'items',
      p_shipping_address   := p_shipping_address,
      p_shipping_fee_cents := p_shipping_fee_cents,
      p_notes              := p_notes,
      p_checkout_group_id  := v_group_id
    );
  end loop;

  return;
end;
$$;

revoke all on function public.create_order_group(jsonb, jsonb, integer, text) from public, anon;
grant execute on function public.create_order_group(jsonb, jsonb, integer, text) to authenticated;

-- New: client passes ONLY the checkout_group_id (never order ids, ownership,
-- or an amount). Every member order is resolved, locked, and re-validated
-- (buyer_id = auth.uid(), not cancelled, still pending) from the group id
-- alone. Total is summed from locked rows -- the only trusted amount source.
-- Idempotent by the group id itself: a still-valid pending attempt for this
-- exact group is reused rather than duplicated.
create or replace function public.begin_xendit_group_payment_attempt(
  p_checkout_group_id uuid,
  p_channel_code       text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_order     public.orders;
  v_result    public.payments;
  v_has_valid boolean;
begin
  if v_uid is null then
    raise exception 'You must be signed in to start a payment' using errcode = '42501';
  end if;

  if p_channel_code not in ('GCASH', 'PAYMAYA', 'CARD') then
    raise exception 'Unsupported payment channel' using errcode = '22023';
  end if;

  perform 1 from public.orders where checkout_group_id = p_checkout_group_id for update;
  if not found then
    raise exception 'Checkout group not found' using errcode = 'P0002';
  end if;

  for v_order in
    select * from public.orders where checkout_group_id = p_checkout_group_id for update
  loop
    if v_order.buyer_id <> v_uid then
      raise exception 'You do not have permission to pay for this order' using errcode = '42501';
    end if;
    if v_order.order_status = 'cancelled' then
      raise exception 'This order has been cancelled' using errcode = '22023';
    end if;
    if v_order.payment_status <> 'pending' then
      raise exception 'This order is not awaiting payment' using errcode = '22023';
    end if;
  end loop;

  select exists (
    select 1 from public.payments
    where checkout_group_id = p_checkout_group_id
      and payment_channel = p_channel_code
      and status = 'pending'
      and (
        (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
        or (xendit_payment_request_id is not null and (expires_at is null or expires_at > now()))
      )
  ) into v_has_valid;

  if not v_has_valid then
    insert into public.payments (
      order_id, payment_method_type, payment_channel, amount_cents, currency, status, checkout_group_id
    )
    select o.id, 'xendit', p_channel_code, o.total_cents, o.currency, 'pending', p_checkout_group_id
    from public.orders o
    where o.checkout_group_id = p_checkout_group_id;
  end if;

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id and payment_channel = p_channel_code
  order by created_at desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.begin_xendit_group_payment_attempt(uuid, text) from public, anon;
grant execute on function public.begin_xendit_group_payment_attempt(uuid, text) to authenticated;

-- New: mirrors finalize_xendit_payment_request but updates every payment row
-- sharing the group id, scoped to the caller's own orders.
create or replace function public.finalize_xendit_group_payment_request(
  p_checkout_group_id         uuid,
  p_xendit_payment_request_id text,
  p_checkout_url              text,
  p_expires_at                timestamptz default null,
  p_status                    text default 'pending'
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_result public.payments;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  perform 1 from public.payments where checkout_group_id = p_checkout_group_id for update;
  if not found then
    raise exception 'Payment group not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.payments p join public.orders o on o.id = p.order_id
    where p.checkout_group_id = p_checkout_group_id and o.buyer_id <> v_uid
  ) then
    raise exception 'You do not have permission to modify this payment' using errcode = '42501';
  end if;

  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where checkout_group_id = p_checkout_group_id;

  select * into v_result from public.payments where checkout_group_id = p_checkout_group_id limit 1;
  return v_result;
end;
$$;

revoke all on function public.finalize_xendit_group_payment_request(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.finalize_xendit_group_payment_request(uuid, text, text, timestamptz, text) to authenticated;

-- process_xendit_webhook: group-resolution path prepended. Single-payment
-- path below is preserved byte-for-byte from the current live function.
create or replace function public.process_xendit_webhook(
  p_reference_id              uuid,
  p_xendit_payment_request_id text,
  p_xendit_payment_id         text,
  p_status                    text,
  p_amount_cents              integer,
  p_currency                  text,
  p_raw_payload               jsonb,
  p_channel_code              text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment     public.payments;
  v_order       public.orders;
  v_new_status  public.payment_status;
  v_is_group    boolean;
  v_all_final   boolean;
  v_group_total integer;
  v_group_ccy   text;
  v_member      record;
  v_result      public.payments;
begin
  select exists(select 1 from public.payments where checkout_group_id = p_reference_id) into v_is_group;

  if v_is_group then
    -- Card exception mirrors the single-payment branch below: a Card
    -- payment's underlying payment_request id (webhook's p_xendit_payment_request_id,
    -- "pr-...") legitimately differs from the Card session id stored on the
    -- payments rows ("ps-...", set by finalize_xendit_group_payment_request).
    -- Without this exception every Card group webhook is wrongly rejected as
    -- reference_mismatch and the group is stuck pending forever.
    if exists (
      select 1 from public.payments
      where checkout_group_id = p_reference_id
        and payment_channel <> 'CARD'
        and xendit_payment_request_id is distinct from p_xendit_payment_request_id
    ) then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'reference_mismatch', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    select bool_and(status in ('paid', 'failed')) into v_all_final
    from public.payments where checkout_group_id = p_reference_id;

    if v_all_final then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'duplicate_or_late', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    select sum(amount_cents), max(currency) into v_group_total, v_group_ccy
    from public.payments where checkout_group_id = p_reference_id;

    if p_amount_cents is distinct from v_group_total or p_currency is distinct from v_group_ccy then
      update public.payments
      set status = 'failed',
          failure_reason = 'amount_mismatch',
          payment_channel = coalesce(p_channel_code, payment_channel),
          xendit_payment_id = p_xendit_payment_id,
          provider_response = p_raw_payload,
          verified_at = now()
      where checkout_group_id = p_reference_id and status = 'pending';

      update public.orders o set payment_status = 'failed'
      from public.payments p
      where p.order_id = o.id and p.checkout_group_id = p_reference_id and o.payment_status = 'pending';

      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'amount_mismatch', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    v_new_status := case
      when p_status = 'SUCCEEDED' then 'paid'::public.payment_status
      when p_status in ('FAILED', 'EXPIRED', 'CANCELED') then 'failed'::public.payment_status
      else null
    end;

    if v_new_status is null then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'ignored_transient_status', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    for v_member in
      select p.id as payment_id, p.status as payment_status, o.id as order_id, o.order_status
      from public.payments p join public.orders o on o.id = p.order_id
      where p.checkout_group_id = p_reference_id
      for update of p, o
    loop
      if v_member.payment_status in ('paid', 'failed') then
        insert into public.payment_webhook_events (
          xendit_payment_request_id, xendit_payment_id, reference_id,
          event_type, status, payment_row_id, processing_result, raw_payload
        ) values (
          p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
          'payment', p_status, v_member.payment_id, 'duplicate_or_late', p_raw_payload
        );
        continue;
      end if;

      if v_member.order_status = 'cancelled' then
        insert into public.payment_webhook_events (
          xendit_payment_request_id, xendit_payment_id, reference_id,
          event_type, status, payment_row_id, processing_result, raw_payload
        ) values (
          p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
          'payment', p_status, v_member.payment_id, 'order_cancelled', p_raw_payload
        );
        continue;
      end if;

      update public.payments
      set status = v_new_status,
          payment_channel = coalesce(p_channel_code, payment_channel),
          xendit_payment_request_id = coalesce(p_xendit_payment_request_id, xendit_payment_request_id),
          xendit_payment_id = p_xendit_payment_id,
          failure_reason = case when v_new_status = 'failed' then 'xendit_status:' || p_status else null end,
          provider_response = p_raw_payload,
          verified_at = now()
      where id = v_member.payment_id;

      update public.orders set payment_status = v_new_status where id = v_member.order_id;

      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, v_member.payment_id, 'applied', p_raw_payload
      );
    end loop;

    select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
    return v_result;
  end if;

  select * into v_payment
  from public.payments
  where id = p_reference_id
  for update;

  if not found then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, null, 'unknown_reference', p_raw_payload
    );
    return null;
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_payment.payment_channel <> 'CARD'
     and v_payment.xendit_payment_request_id is distinct from p_xendit_payment_request_id
  then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'reference_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  if v_payment.status in ('paid', 'failed') then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'duplicate_or_late', p_raw_payload
    );
    return v_payment;
  end if;

  if v_order.order_status = 'cancelled' then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'order_cancelled', p_raw_payload
    );
    return v_payment;
  end if;

  if p_amount_cents is distinct from v_payment.amount_cents
     or p_currency is distinct from v_payment.currency
  then
    update public.payments
    set status = 'failed',
        failure_reason = 'amount_mismatch',
        payment_channel = coalesce(p_channel_code, payment_channel),
        xendit_payment_id = p_xendit_payment_id,
        provider_response = p_raw_payload,
        verified_at = now()
    where id = v_payment.id
    returning * into v_payment;

    update public.orders set payment_status = 'failed' where id = v_order.id;

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'amount_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  v_new_status := case
    when p_status = 'SUCCEEDED' then 'paid'::public.payment_status
    when p_status in ('FAILED', 'EXPIRED', 'CANCELED') then 'failed'::public.payment_status
    else null
  end;

  if v_new_status is null then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'ignored_transient_status', p_raw_payload
    );
    return v_payment;
  end if;

  update public.payments
  set status = v_new_status,
      payment_channel = coalesce(p_channel_code, payment_channel),
      xendit_payment_request_id = coalesce(p_xendit_payment_request_id, xendit_payment_request_id),
      xendit_payment_id = p_xendit_payment_id,
      failure_reason = case when v_new_status = 'failed' then 'xendit_status:' || p_status else null end,
      provider_response = p_raw_payload,
      verified_at = now()
  where id = v_payment.id
  returning * into v_payment;

  update public.orders set payment_status = v_new_status where id = v_order.id;

  insert into public.payment_webhook_events (
    xendit_payment_request_id, xendit_payment_id, reference_id,
    event_type, status, payment_row_id, processing_result, raw_payload
  ) values (
    p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
    'payment', p_status, v_payment.id, 'applied', p_raw_payload
  );

  return v_payment;
end;
$$;

revoke all on function public.process_xendit_webhook(uuid, text, text, text, integer, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.process_xendit_webhook(uuid, text, text, text, integer, text, jsonb, text) to service_role;

-- enforce_order_update_rules: block cancellation (any actor) while an order
-- has a genuinely active Xendit payment -- single-order or group. Placed
-- before the actor-branch logic so it applies uniformly to buyer, seller,
-- and admin. COD orders (zero Xendit rows) and expired/failed attempts are
-- unaffected.
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
        and p.xendit_payment_request_id is not null
        and (p.expires_at is null or p.expires_at > now())
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
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if v_uid = old.seller_id
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

  return new;
end;
$$;

commit;
