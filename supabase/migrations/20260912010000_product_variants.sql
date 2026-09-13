-- =============================================================================
-- Product Variants — Phase 3a (schema + RPC layer only, per the Phase 3 audit).
--
-- Additive/optional, matching this repo's own established evolution style
-- (shops/inventory were introduced the same way): a NEW `product_variants`
-- table plus a nullable `variant_id` column on the tables that already do
-- stock/order math. Every existing product, order, and inventory row has
-- `variant_id = NULL` and keeps working through the exact same code paths as
-- before this migration — nothing about the non-variant flow changes.
--
-- Deliberately NOT done here (out of scope for 3a, tracked for 3b/3c/3d):
--  * No quantity column on product_variants — stock stays exclusively in
--    `inventory`/`stock_adjustments`/`adjust_stock`, reusing the existing
--    audited RPC instead of forking a second stock system. This also avoids
--    adding product_variants as a third FOR UPDATE lock target.
--  * `product_images` is untouched — variant-specific photos are Phase 3d.
--  * No frontend/UI/application code is touched — CheckoutForm, ProductForm,
--    the cart, PDP, `queries.createOrder`/`queries.adjustStock` JS wrappers
--    are all unmodified. Both RPC changes below are additive-only (new
--    optional parameter / optional jsonb key with NULL-safe defaults), so
--    every existing caller keeps working with zero JS changes.
--
-- NULL-uniqueness note: Postgres treats multiple NULLs in a UNIQUE
-- constraint as distinct, so a naive `unique(x, variant_id)` would silently
-- stop enforcing "one row per non-variant x". Every constraint touched below
-- is replaced with a PAIR of partial unique indexes instead — one for
-- variant_id IS NULL (today's exact invariant, unchanged), one for
-- variant_id IS NOT NULL (the new per-variant invariant).
--
-- Lock ordering preserved: `create_order` still locks `inventory` before
-- `products`, exactly as established in 20260815000000_inventory_and_stock_
-- history.sql. Variant validation is a plain (non-locking) read of
-- `product_variants` before that lock sequence — product_variants is never
-- FOR UPDATE-locked by create_order/adjust_stock, so it never enters the
-- deadlock graph those two RPCs were carefully ordered to avoid.
--
-- ROLLBACK:
--   drop trigger product_variants_seed_inventory on public.product_variants;
--   drop function public.seed_inventory_for_variant();
--   drop trigger product_variants_set_updated_at on public.product_variants;
--   -- restore create_order/adjust_stock/restock_on_order_cancel/
--   -- sync_products_quantity_from_inventory/seed_inventory_for_product
--   -- bodies from 20260815000000_inventory_and_stock_history.sql
--   alter table public.order_items drop constraint order_items_variant_label_length;
--   drop index public.order_items_unique_no_variant;
--   drop index public.order_items_unique_variant;
--   alter table public.order_items add constraint order_items_unique_product_per_order unique (order_id, product_id);
--   alter table public.order_items drop column variant_id, drop column variant_label;
--   alter table public.stock_adjustments drop column variant_id;
--   drop index public.inventory_product_only_key;
--   drop index public.inventory_variant_key;
--   alter table public.inventory add constraint inventory_product_id_key unique (product_id);
--   alter table public.inventory drop column variant_id;
--   drop table public.product_variants;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- product_variants
--
-- seller_id/shop_id are denormalized copies of the parent product's, same
-- reasoning inventory/stock_adjustments already denormalize shop_id off
-- products — lets RLS scope variant rows with a direct column comparison
-- instead of a join on every read, and is defensively re-validated in the
-- INSERT/UPDATE policies below (never trusted as self-consistent).
--
-- Two known attributes (color/size), not a generic EAV system — a capstone
-- doesn't need arbitrary N-dimensional variant attributes.
-- -----------------------------------------------------------------------------
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  shop_id     uuid references public.shops (id),

  sku         text,
  color       text,
  size        text,
  -- null = inherit products.price_cents (common case: same price, different stock).
  price_cents integer,
  status      public.product_status not null default 'active',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint product_variants_has_attribute check (color is not null or size is not null),
  constraint product_variants_unique_combo unique (product_id, color, size),
  constraint product_variants_price_positive check (price_cents is null or price_cents > 0),
  constraint product_variants_sku_length check (sku is null or char_length(sku) <= 60),
  constraint product_variants_color_length check (color is null or char_length(color) <= 60),
  constraint product_variants_size_length check (size is null or char_length(size) <= 60)
);

comment on table public.product_variants is
  'Optional color/size variants for a product. A product with zero rows here is a plain single-SKU listing — nothing else in the schema requires this table to be populated. Stock lives in inventory (variant_id-keyed), not here.';

create index product_variants_product_id_idx on public.product_variants (product_id);
create index product_variants_seller_id_idx on public.product_variants (seller_id);
create index product_variants_shop_id_idx on public.product_variants (shop_id);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- inventory: add variant_id, relax the 1-row-per-product invariant into two
-- partial invariants (one row per non-variant product, one row per variant).
-- -----------------------------------------------------------------------------
alter table public.inventory
  add column variant_id uuid references public.product_variants (id) on delete cascade;

alter table public.inventory drop constraint inventory_product_id_key;

create unique index inventory_product_only_key
  on public.inventory (product_id) where variant_id is null;
create unique index inventory_variant_key
  on public.inventory (variant_id) where variant_id is not null;

comment on column public.inventory.variant_id is
  'Null for a plain product-level stock row (today''s exact behavior). Set for a per-variant stock row — product_id stays populated even then, so existing RLS/queries keyed on product_id are unaffected.';


-- -----------------------------------------------------------------------------
-- stock_adjustments: add variant_id (audit trail only, no uniqueness needed
-- — this table is append-only).
-- -----------------------------------------------------------------------------
alter table public.stock_adjustments
  add column variant_id uuid references public.product_variants (id) on delete cascade;


-- -----------------------------------------------------------------------------
-- order_items: add variant_id + a variant_label snapshot (mirrors
-- product_title's "never rewrite history" philosophy), relax the
-- one-line-per-product invariant the same way as inventory above.
-- -----------------------------------------------------------------------------
alter table public.order_items
  add column variant_id uuid references public.product_variants (id) on delete restrict,
  add column variant_label text;

alter table public.order_items
  add constraint order_items_variant_label_length
    check (variant_label is null or char_length(variant_label) <= 200);

alter table public.order_items drop constraint order_items_unique_product_per_order;

create unique index order_items_unique_no_variant
  on public.order_items (order_id, product_id) where variant_id is null;
create unique index order_items_unique_variant
  on public.order_items (order_id, product_id, variant_id) where variant_id is not null;

comment on column public.order_items.variant_id is
  'Snapshot reference to the purchased variant, null for a non-variant line — ON DELETE RESTRICT, same historical-integrity reasoning as product_id.';
comment on column public.order_items.variant_label is
  'Snapshot display label (e.g. "Blue / Medium") captured at purchase time — never re-derived from product_variants, which may change or be deleted later.';


-- -----------------------------------------------------------------------------
-- seed_inventory_for_product: unchanged logic, only the ON CONFLICT target
-- updated to match the new partial unique index (the old plain
-- `unique(product_id)` index this relied on no longer exists).
-- -----------------------------------------------------------------------------
create or replace function public.seed_inventory_for_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id, shop_id, quantity)
  values (new.id, new.shop_id, new.quantity)
  on conflict (product_id) where variant_id is null do nothing;

  if new.quantity > 0 then
    insert into public.stock_adjustments (
      product_id, shop_id, delta, previous_quantity, new_quantity, reason,
      note, created_by
    )
    values (
      new.id, new.shop_id, new.quantity, 0, new.quantity, 'initial_stock',
      'Initial stock at product creation', new.seller_id
    );
  end if;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- New trigger: seed a zero-quantity inventory row the instant a variant is
-- created — mirrors products_seed_inventory's "every stock-bearing entity
-- always has exactly one inventory row" invariant. Variants start at 0 (there
-- is no quantity column on product_variants to seed from); the seller brings
-- it up afterward via adjust_stock (reason 'restock'/'correction' — both
-- already valid, no special-casing needed), exactly like a product created
-- with quantity: 0 today gets no 'initial_stock' history row either.
-- -----------------------------------------------------------------------------
create or replace function public.seed_inventory_for_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id, variant_id, shop_id, quantity)
  values (new.product_id, new.id, new.shop_id, 0)
  on conflict (variant_id) where variant_id is not null do nothing;

  return new;
end;
$$;

create trigger product_variants_seed_inventory
  after insert on public.product_variants
  for each row execute function public.seed_inventory_for_variant();

-- Same hardening as the other trigger-only functions
-- (20260904000000_revoke_trigger_function_execute.sql) — applied upfront
-- here rather than as a follow-up pass.
revoke execute on function public.seed_inventory_for_variant() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- sync_products_quantity_from_inventory: skip the products.quantity/status
-- mirror entirely when the changed inventory row is variant-level. A
-- variant-bearing product's products.quantity/status become frozen at
-- whatever they were before variants existed — an accepted, documented
-- limitation (same "documented, not solved" style as TD-9), not a rollup,
-- to keep this change small. Non-variant rows (variant_id is null) behave
-- byte-for-byte as before.
-- -----------------------------------------------------------------------------
create or replace function public.sync_products_quantity_from_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.variant_id is not null then
    return new;
  end if;

  if new.quantity is distinct from old.quantity then
    update public.products
    set quantity = new.quantity,
        status = case
          when new.quantity = 0 and status = 'active' then 'sold'::public.product_status
          when new.quantity > 0 and status = 'sold' then 'active'::public.product_status
          else status
        end
    where id = new.product_id;
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- restock_on_order_cancel: restock the variant-level row when the cancelled
-- order's line item was a variant purchase, else the product-level row —
-- unchanged behavior for every historical/non-variant order.
-- -----------------------------------------------------------------------------
create or replace function public.restock_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item      record;
  v_inventory public.inventory;
begin
  for v_item in
    select product_id, variant_id, quantity
    from public.order_items
    where order_id = new.id
  loop
    if v_item.variant_id is not null then
      select * into v_inventory
      from public.inventory
      where variant_id = v_item.variant_id
      for update;
    else
      select * into v_inventory
      from public.inventory
      where product_id = v_item.product_id and variant_id is null
      for update;
    end if;

    if not found then
      -- Defensive only: every product/variant has an inventory row via the
      -- seed triggers, so this should be unreachable.
      continue;
    end if;

    update public.inventory
    set quantity = v_inventory.quantity + v_item.quantity
    where id = v_inventory.id;

    insert into public.stock_adjustments (
      product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
      reason, note, related_order_id, created_by
    )
    values (
      v_item.product_id, v_item.variant_id, v_inventory.shop_id, v_item.quantity,
      v_inventory.quantity, v_inventory.quantity + v_item.quantity,
      'cancellation_restock', 'Restocked from cancelled order ' || new.order_number,
      new.id, null
    );
  end loop;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- adjust_stock: adding a parameter changes the function's type signature, so
-- the old-signature overload must be dropped explicitly rather than replaced
-- in place (Postgres identifies functions by name + ordered parameter
-- types) — same pattern already used by
-- 20260905162555_xendit_rpc_optional_params_fixed.sql. All callers use
-- named-argument .rpc() calls (order-independent), so omitting p_variant_id
-- is safe and behaves exactly as before.
-- -----------------------------------------------------------------------------
drop function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text);

create function public.adjust_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     public.stock_adjustment_reason,
  p_note       text default null,
  p_variant_id uuid default null
)
returns public.inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid               uuid := (select auth.uid());
  v_role               public.user_role;
  v_product            public.products;
  v_variant            public.product_variants;
  v_inventory          public.inventory;
  v_previous_quantity  integer;
  v_new_quantity       integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in to adjust stock' using errcode = '42501';
  end if;

  v_role := public.current_user_role();
  if v_role not in ('seller', 'admin') then
    raise exception 'You do not have permission to adjust stock' using errcode = '42501';
  end if;

  if p_delta = 0 then
    raise exception 'Adjustment must not be zero' using errcode = '22023';
  end if;

  if p_reason in ('initial_stock', 'sale', 'cancellation_restock') then
    raise exception 'This reason is reserved for system-driven adjustments'
      using errcode = '22023';
  end if;

  -- Plain (non-locking) read: only needed for the authorization check, never
  -- written here, so it cannot participate in the inventory-then-products
  -- lock ordering described at the top of the parent migration.
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if v_product.seller_id <> v_uid
     and not public.is_shop_member(v_product.shop_id)
     and not public.is_admin()
  then
    raise exception 'You do not have permission to adjust stock for this product'
      using errcode = '42501';
  end if;

  if p_variant_id is not null then
    -- Plain (non-locking) read — same reasoning as the products read above;
    -- product_variants is never FOR UPDATE-locked by this RPC.
    select * into v_variant
    from public.product_variants
    where id = p_variant_id;

    if not found or v_variant.product_id <> p_product_id then
      raise exception 'Variant not found for this product' using errcode = 'P0002';
    end if;

    select * into v_inventory
    from public.inventory
    where variant_id = p_variant_id
    for update;
  else
    select * into v_inventory
    from public.inventory
    where product_id = p_product_id and variant_id is null
    for update;
  end if;

  if not found then
    raise exception 'Inventory record not found for this product' using errcode = 'P0002';
  end if;

  v_previous_quantity := v_inventory.quantity;
  v_new_quantity := v_previous_quantity + p_delta;

  if v_new_quantity < 0 then
    raise exception 'Cannot reduce stock below zero (currently %)', v_previous_quantity
      using errcode = '23514';
  end if;

  update public.inventory
  set quantity = v_new_quantity
  where id = v_inventory.id
  returning * into v_inventory;

  insert into public.stock_adjustments (
    product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
    reason, note, created_by
  )
  values (
    p_product_id, p_variant_id, v_inventory.shop_id, p_delta, v_previous_quantity,
    v_new_quantity, p_reason, p_note, v_uid
  );

  return v_inventory;
end;
$$;

comment on function public.adjust_stock is
  'Sole manual write path into inventory/stock_adjustments — product-level (p_variant_id null) or variant-level. Locks inventory before touching products (via the sync trigger) to match create_order''s lock order.';

revoke all on function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text, uuid)
  from public, anon;
grant execute on function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text, uuid)
  to authenticated;


-- -----------------------------------------------------------------------------
-- create_order: same signature (p_items' shape is data, not a parameter, so
-- no drop/recreate needed) — replaced in place, exactly like the original
-- inventory migration replaced this body without changing the signature.
-- Each item in p_items may now optionally include a "variant_id" key
-- (absent/null = today's exact non-variant behavior). Lock order preserved:
-- inventory (by variant_id or product_id) is still locked before products;
-- the product_variants validation read is a plain, non-locking SELECT that
-- happens before any FOR UPDATE lock, so it never joins the deadlock graph.
-- -----------------------------------------------------------------------------
create or replace function public.create_order(
  p_seller_id        uuid,
  p_items            jsonb,
  p_shipping_address jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes            text default null
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

  -- Reserve stock first so the order total is computed from locked rows.
  -- Inventory is locked before products on purpose — see the lock-ordering
  -- note at the top of the parent migration.
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

    -- Mixing currencies inside one order would make total_cents meaningless.
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
    currency, shipping_address, notes
  )
  values (
    v_buyer_id, p_seller_id, v_subtotal, p_shipping_fee_cents,
    v_subtotal + p_shipping_fee_cents, v_currency, p_shipping_address, p_notes
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

    -- Row is already locked from the validation loop above; a plain re-select
    -- reads the same locked, still-consistent value.
    if v_variant_id is not null then
      select * into v_inventory
      from public.inventory
      where variant_id = v_variant_id;
    else
      select * into v_inventory
      from public.inventory
      where product_id = v_product.id and variant_id is null;
    end if;

    -- Decrementing inventory (not products directly) is what
    -- inventory_sync_products_quantity mirrors back onto
    -- products.quantity/status (non-variant rows only — see that
    -- function's own guard).
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

comment on function public.create_order is
  'Atomically validates stock, creates an order with its items, and decrements inventory (products.quantity syncs via trigger for non-variant lines). Each item may optionally carry a variant_id; price falls back to the product price when the variant has none of its own.';


-- -----------------------------------------------------------------------------
-- Grants + RLS for product_variants — plain RLS-gated CRUD, matching
-- products' own pattern (not RPC-gated: there's no financial/stock
-- invariant on this table itself, only catalog attributes; stock stays
-- behind adjust_stock/create_order as before).
-- -----------------------------------------------------------------------------
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

alter table public.product_variants enable row level security;

create policy "active variants of active products are publicly readable"
  on public.product_variants for select
  to anon
  using (
    status = 'active'
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
  );

create policy "buyers read active variants, sellers read their own"
  on public.product_variants for select
  to authenticated
  using (
    (
      status = 'active'
      and exists (
        select 1 from public.products p
        where p.id = product_variants.product_id and p.status = 'active'
      )
    )
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

create policy "sellers insert their own variants"
  on public.product_variants for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and public.current_user_role() in ('seller', 'admin')
    and (shop_id is null or public.is_shop_member(shop_id) or public.is_admin())
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = product_variants.seller_id
    )
  );

create policy "sellers update their own variants"
  on public.product_variants for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  )
  with check (
    (seller_id = (select auth.uid()) or public.is_shop_member(shop_id) or public.is_admin())
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = product_variants.seller_id
    )
  );

create policy "sellers delete their own variants"
  on public.product_variants for delete
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

-- inventory/stock_adjustments RLS is unchanged and needs no new policy:
-- both existing SELECT policies key off `inventory.product_id`/
-- `stock_adjustments.product_id`, which stays populated (denormalized) on
-- every variant-level row too, so a seller/admin sees their variant stock
-- rows through the exact same predicate as their product-level ones.
-- order_items RLS is also unchanged — its policy derives visibility from
-- the parent order, not from product_id/variant_id directly.

commit;
