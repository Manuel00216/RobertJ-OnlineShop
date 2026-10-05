-- ============================================================================
-- Order-creation idempotency (Buyer-audit #5)
--
-- Prevents a duplicate checkout submission (double-click, force-refresh,
-- lost-response retry) from creating duplicate orders. A client-supplied
-- idempotency key makes create_order / create_order_group replay the already-
-- created order(s) instead of creating new ones.
--
-- Additive + idempotent: new table (create if not exists) and in-place
-- function replacements that keep every existing param/behaviour, appending a
-- single DEFAULT NULL p_idempotency_key so all existing callers keep working.
-- When the key is NULL the functions behave exactly as before.
--
-- NOTE: a follow-up migration
-- (20261004155312_order_creation_idempotency_fix_overload_and_anon_grant)
-- drops the correct pre-idempotency create_order signature and revokes the
-- anon EXECUTE that Supabase default privileges re-grant on recreate. Both were
-- applied to the live database together.
--
-- Wrapped in begin/commit (this repo's established migration convention —
-- see e.g. 20260819150133_oauth_profile_metadata_coalesce.sql) and the two
-- revoke statements below now include `anon` explicitly, so this migration
-- is self-contained: even applied alone (a crashed/partial deploy, a fresh
-- environment replaying history), the anon-EXECUTE window the follow-up
-- migration above was written to close never opens in the first place.
-- ============================================================================

begin;

-- Dedup ledger. `scope` namespaces an attempt:
--   * create_order  -> scope = p_seller_id  (one order per seller in the loop,
--     so the same attempt key can be reused across sellers without colliding)
--   * create_order_group -> scope = all-zero sentinel (one logical attempt that
--     produces several orders; a real seller_id can never be the nil UUID)
create table if not exists public.order_idempotency_keys (
  buyer_id        uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  scope           uuid not null,
  order_ids       uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  primary key (buyer_id, idempotency_key, scope)
);

comment on table public.order_idempotency_keys is
  'Idempotency ledger for order creation. Written only by the SECURITY DEFINER create_order/create_order_group RPCs (owner postgres bypasses RLS); never touched by clients. A repeat call with the same (buyer_id, idempotency_key, scope) replays the recorded order_ids instead of creating new orders.';

-- Clients never read/write this directly; RLS on + no policy denies all
-- non-owner roles. The order RPCs run as their owner (postgres) and bypass it.
alter table public.order_idempotency_keys enable row level security;

-- ----------------------------------------------------------------------------
-- create_order: adds p_idempotency_key (last, DEFAULT NULL).
-- ----------------------------------------------------------------------------
drop function if exists public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text);

create function public.create_order(
  p_seller_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes text default null,
  p_checkout_group_id uuid default null,
  p_payment_method text default 'cod',
  p_idempotency_key uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path to ''
as $fn$
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

  -- Idempotency: a repeat of the same checkout attempt (same buyer + key +
  -- seller scope) must return the already-created order instead of making a
  -- second one. Claiming the key first serializes a concurrent duplicate on
  -- the unique index until this txn commits (then the loser replays) or rolls
  -- back (then the loser legitimately proceeds). Placed before the stock work
  -- so a detected duplicate does no inventory churn.
  if p_idempotency_key is not null then
    insert into public.order_idempotency_keys (buyer_id, idempotency_key, scope)
    values (v_buyer_id, p_idempotency_key, p_seller_id)
    on conflict (buyer_id, idempotency_key, scope) do nothing;

    if not found then
      select o.* into v_order
      from public.orders o
      join public.order_idempotency_keys k
        on k.buyer_id = v_buyer_id
       and k.idempotency_key = p_idempotency_key
       and k.scope = p_seller_id
      where o.id = any (k.order_ids)
      limit 1;

      if found then
        return v_order;
      end if;
      -- Key claimed but no order recorded: a prior attempt rolled back after
      -- claiming (shouldn't persist, same txn) — fail closed rather than risk
      -- a silent duplicate.
      raise exception 'Duplicate order submission' using errcode = '23505';
    end if;
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

  -- Record the produced order against the claimed key so a later repeat replays
  -- it (committed atomically with the order itself).
  if p_idempotency_key is not null then
    update public.order_idempotency_keys
    set order_ids = array[v_order.id]
    where buyer_id = v_buyer_id
      and idempotency_key = p_idempotency_key
      and scope = p_seller_id;
  end if;

  return v_order;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- create_order_group: adds p_idempotency_key (last, DEFAULT NULL). Group-level
-- dedup; inner create_order calls deliberately pass no key.
-- ----------------------------------------------------------------------------
drop function if exists public.create_order_group(jsonb, jsonb, integer, text, text);

create function public.create_order_group(
  p_groups jsonb,
  p_shipping_address jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes text default null,
  p_payment_method text default 'cod',
  p_idempotency_key uuid default null
)
returns setof public.orders
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_group_id uuid := gen_random_uuid();
  v_group    jsonb;
  v_buyer    uuid := (select auth.uid());
  v_order    public.orders;
  v_created  uuid[] := '{}';
  -- Nil UUID: the scope for a whole-group attempt. A real seller_id is never
  -- the nil UUID, so this can't collide with a single-order scope.
  v_scope    constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'At least one seller group is required' using errcode = '22023';
  end if;

  -- Group-level idempotency: replay the whole batch on a repeat. (Guarded on a
  -- non-null buyer so the dedup insert can't hit a NOT NULL before the inner
  -- create_order raises its own 'Authentication required'.)
  if p_idempotency_key is not null and v_buyer is not null then
    insert into public.order_idempotency_keys (buyer_id, idempotency_key, scope)
    values (v_buyer, p_idempotency_key, v_scope)
    on conflict (buyer_id, idempotency_key, scope) do nothing;

    if not found then
      return query
        select o.*
        from public.orders o
        join public.order_idempotency_keys k
          on k.buyer_id = v_buyer
         and k.idempotency_key = p_idempotency_key
         and k.scope = v_scope
        where o.id = any (k.order_ids)
        order by o.placed_at, o.id;
      return;
    end if;
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    -- No p_idempotency_key here: the group-level claim above is the single
    -- dedup point; inner calls must not self-dedup.
    v_order := public.create_order(
      p_seller_id          := (v_group ->> 'seller_id')::uuid,
      p_items              := v_group -> 'items',
      p_shipping_address   := p_shipping_address,
      p_shipping_fee_cents := p_shipping_fee_cents,
      p_notes              := p_notes,
      p_checkout_group_id  := v_group_id,
      p_payment_method     := p_payment_method
    );
    v_created := v_created || v_order.id;
    return next v_order;
  end loop;

  if p_idempotency_key is not null and v_buyer is not null then
    update public.order_idempotency_keys
    set order_ids = v_created
    where buyer_id = v_buyer
      and idempotency_key = p_idempotency_key
      and scope = v_scope;
  end if;

  return;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- Re-apply the exact pre-existing grants (recreating a function resets its ACL
-- to the default PUBLIC EXECUTE). Original: EXECUTE for authenticated +
-- service_role only; anon/public excluded. `anon` is included explicitly here
-- (not left to the follow-up migration alone) so this migration can never
-- leave anon with EXECUTE even momentarily — see the header note.
-- ----------------------------------------------------------------------------
revoke all on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text, uuid) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text, uuid) to authenticated, service_role;

revoke all on function public.create_order_group(jsonb, jsonb, integer, text, text, uuid) from public, anon;
grant execute on function public.create_order_group(jsonb, jsonb, integer, text, text, uuid) to authenticated, service_role;

commit;
