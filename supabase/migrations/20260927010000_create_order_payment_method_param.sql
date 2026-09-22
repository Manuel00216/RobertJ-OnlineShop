-- =============================================================================
-- Xendit payment recovery, step B of F: `create_order`/`create_order_group`
-- now accept and persist `p_payment_method`, so "this order wants online
-- payment" is recorded at insert time -- not inferred later from whether the
-- best-effort Xendit reservation in `placeOrderAction` happened to succeed.
--
-- `p_payment_method` is `text`, defaulted to `'cod'` so any existing/unknown
-- caller keeps working unchanged, and validated against the same allowed set
-- as the new `order_payment_method` enum -- mirrors how `p_channel_code` is
-- validated in `begin_xendit_payment_attempt` (raise a clear error rather
-- than relying solely on the enum cast's generic error). The enum column
-- itself is the second, unconditional layer of defense.
--
-- Both functions are otherwise byte-for-byte identical to the current live
-- bodies (confirmed via pg_get_functiondef): no change to pricing,
-- stock-decrement, `order_items`, or `stock_adjustments` logic.
--
-- Adding a new parameter changes each function's identity (Postgres
-- resolves overloads by argument-type signature, not just name) -- a plain
-- `CREATE OR REPLACE FUNCTION` with an extra trailing arg does *not* replace
-- the old 6-arg/4-arg version in place, it creates a second, ambiguous
-- overload (a 3-positional-arg call then fails with "is not unique" because
-- both the old and new signatures can satisfy it via defaults). Confirmed
-- with a rolled-back transaction before writing this migration, and this
-- codebase already hit exactly this once before, for this same function --
-- see 20260914133006_xendit_phase2_fix_create_order_grants.sql. So the old
-- signatures are dropped first, and the explicit revoke/grant afterward
-- restores the authenticated-only ACL that migration established (a fresh
-- `CREATE FUNCTION` resets ACLs to the Postgres default of no PUBLIC
-- execute plus owner privileges, which already excludes anon here, but the
-- explicit statements make the intended grant state unambiguous rather
-- than relying on that default).
--
-- ROLLBACK:
--   begin;
--   drop function if exists public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text);
--   drop function if exists public.create_order_group(jsonb, jsonb, integer, text, text);
--   -- then restore the previous bodies (6-arg create_order from
--   -- 20260914133006_xendit_phase2_fix_create_order_grants.sql; 4-arg
--   -- create_order_group from 20260914132906_xendit_phase2_multiseller_group_payment.sql)
--   -- and their grants.
--   commit;
-- =============================================================================

begin;

drop function if exists public.create_order(uuid, jsonb, jsonb, integer, text, uuid);
drop function if exists public.create_order_group(jsonb, jsonb, integer, text);

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

  if p_payment_method not in ('cod', 'xendit') then
    raise exception 'Unsupported payment method' using errcode = '22023';
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
    currency, shipping_address, notes, checkout_group_id, payment_method
  )
  values (
    v_buyer_id, p_seller_id, v_subtotal, p_shipping_fee_cents,
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

create or replace function public.create_order_group(
  p_groups              jsonb,
  p_shipping_address    jsonb,
  p_shipping_fee_cents  integer default 0,
  p_notes               text default null,
  p_payment_method      text default 'cod'
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
      p_checkout_group_id  := v_group_id,
      p_payment_method     := p_payment_method
    );
  end loop;

  return;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text) to authenticated;

revoke all on function public.create_order_group(jsonb, jsonb, integer, text, text) from public, anon;
grant execute on function public.create_order_group(jsonb, jsonb, integer, text, text) to authenticated;

commit;
