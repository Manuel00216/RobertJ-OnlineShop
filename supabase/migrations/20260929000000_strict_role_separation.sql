-- =============================================================================
-- Strict role separation — DB backstop: only a `buyer` may create orders or
-- persist a cart/wishlist. Sellers and admins are restricted to their own
-- portals + the public homepage; they must never enter the buyer purchasing
-- flow, including via direct RPC / PostgREST calls that bypass the UI and
-- server actions.
--
-- This is the authoritative (DB) layer of a defense-in-depth change; the
-- `(shop)` layout role guard and the server-action `requireRole([buyer])`
-- checks are the softer outer layers. Uses the existing `current_user_role()`
-- SECURITY DEFINER helper (avoids `profiles` RLS recursion), mirroring how
-- `is_admin()` is used across existing policies.
--
-- Preserved unchanged: the self-purchase guard (`v_buyer_id = p_seller_id`),
-- all pricing / stock-decrement / order_items / stock_adjustments logic, the
-- `orders` SELECT & UPDATE policies, `enforce_order_update_rules`, the
-- `order_status` enum, and the cart/wishlist SELECT & DELETE policies (so a
-- role-changed account can still read and clean up its own leftover rows — no
-- data is destroyed by this migration).
--
-- `create_order` keeps its exact signature, so CREATE OR REPLACE replaces it
-- in place and preserves the existing authenticated-only EXECUTE grant (no
-- re-grant needed). `create_order_group` is NOT modified — it delegates to
-- `create_order` per seller, so the new guard rejects a seller/admin caller on
-- the first delegated call, before any row is written.
--
-- ROLLBACK:
--   begin;
--   -- restore create_order body from 20260927010000_create_order_payment_method_param.sql
--   -- (remove the buyer-role guard block), then:
--   drop policy if exists "buyers create their own orders" on public.orders;
--   create policy "buyers create their own orders" on public.orders for insert to authenticated
--     with check ((buyer_id = (select auth.uid())) and (buyer_id <> seller_id));
--   drop policy if exists "users create their own cart" on public.carts;
--   create policy "users create their own cart" on public.carts for insert to authenticated
--     with check (user_id = (select auth.uid()));
--   drop policy if exists "users insert their own cart items" on public.cart_items;
--   create policy "users insert their own cart items" on public.cart_items for insert to authenticated
--     with check (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));
--   drop policy if exists "users update their own cart items" on public.cart_items;
--   create policy "users update their own cart items" on public.cart_items for update to authenticated
--     using (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())))
--     with check (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));
--   drop policy if exists "users add to their own wishlist" on public.wishlists;
--   create policy "users add to their own wishlist" on public.wishlists for insert to authenticated
--     with check (user_id = (select auth.uid()));
--   commit;
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. create_order: reject non-buyer callers (covers create_order_group too).
--    Body is byte-identical to 20260927010000 except the added guard block
--    immediately after the existing self-purchase check.
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
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_buyer_id = p_seller_id then
    raise exception 'You cannot buy your own listing' using errcode = '22023';
  end if;

  -- Strict role separation: only buyers may place orders.
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

-- ---------------------------------------------------------------------------
-- 2. orders INSERT backstop — add the buyer-role clause (keep ownership +
--    self-purchase guard).
-- ---------------------------------------------------------------------------
drop policy if exists "buyers create their own orders" on public.orders;
create policy "buyers create their own orders"
  on public.orders for insert
  to authenticated
  with check (
    buyer_id = (select auth.uid())
    and buyer_id <> seller_id
    and public.current_user_role() = 'buyer'
  );

-- ---------------------------------------------------------------------------
-- 3. carts / cart_items INSERT (+ cart_items UPDATE) — buyers only.
--    SELECT/DELETE left unchanged so a role-changed account can still read and
--    clear its own leftover rows.
-- ---------------------------------------------------------------------------
drop policy if exists "users create their own cart" on public.carts;
create policy "users create their own cart"
  on public.carts for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_role() = 'buyer'
  );

drop policy if exists "users insert their own cart items" on public.cart_items;
create policy "users insert their own cart items"
  on public.cart_items for insert
  to authenticated
  with check (
    public.current_user_role() = 'buyer'
    and exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "users update their own cart items" on public.cart_items;
create policy "users update their own cart items"
  on public.cart_items for update
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    public.current_user_role() = 'buyer'
    and exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. wishlists INSERT — buyers only. SELECT/DELETE unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "users add to their own wishlist" on public.wishlists;
create policy "users add to their own wishlist"
  on public.wishlists for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_role() = 'buyer'
  );

commit;
