-- =============================================================================
-- Inventory (Phase 4): extracts stock from `products.quantity` into a
-- dedicated `inventory` table + append-only `stock_adjustments` history,
-- per ARCHITECTURE.md Evolution Step 2 (TD-2).
--
-- Design, deliberately conservative — every existing read/write path outside
-- this migration keeps working unchanged:
--  * `products.quantity` is NOT dropped. It becomes a trigger-synced mirror
--    of `inventory.quantity`, kept accurate by `inventory_sync_products_quantity`
--    below. PDP, `ProductTile`, the cart, `getProductsPriceAndStock`, and
--    `create_order`'s callers all keep reading `products.quantity` exactly as
--    today.
--  * `create_order` keeps its exact signature and error shape (including the
--    `'Only % left of %'` message, errcode 23514) — only what it locks and
--    decrements moves from `products` to `inventory`.
--  * `cancelBuyerOrder` (application code) is NOT touched — the new
--    `orders_restock_on_cancel` trigger restocks automatically on the
--    existing `.update(order_status = 'cancelled')` call, covering any future
--    cancellation path (seller/admin) too, not just the buyer's.
--  * Every product's `products_seed_inventory` trigger guarantees an
--    `inventory` row exists the instant the product does — no application
--    code needs to create one.
--
-- Lock ordering — inventory before products, everywhere:
--  `adjust_stock` only ever needs a direct row lock on `inventory` (the
--  authorization read of `products.seller_id`/`shop_id` is a plain,
--  non-locking SELECT); its later UPDATE of `inventory.quantity` fires
--  `inventory_sync_products_quantity`, which locks & updates `products`
--  *while still holding the inventory lock*. For `create_order` to never
--  deadlock against that, it must acquire its own lock on `inventory` before
--  it locks `products` too — the reverse of the original schema's plain
--  `products FOR UPDATE`. Both `create_order` and `adjust_stock` below always
--  lock `inventory` first; `products` is only ever locked (explicitly or via
--  the sync trigger) after that.
--
-- Auto sold/active symmetry: `create_order` already flips a product to
-- 'sold' the instant it hits zero stock. `inventory_sync_products_quantity`
-- extends this symmetrically — quantity going from 0 to positive flips
-- 'sold' back to 'active' — but ONLY out of 'sold'. A `draft` or `archived`
-- product is never touched by this trigger, so an intentionally discontinued
-- (archived) listing that's restocked for record-keeping stays archived.
--
-- Deferred (see ARCHITECTURE.md Technical Debt Register, new row): a failed/
-- rejected QR payment does not restock. That is a Payments-module business
-- rule (does a failed payment also cancel the order?) left for its own
-- deliberate change, not bundled here.
--
-- ROLLBACK:
--   drop trigger orders_restock_on_cancel on public.orders;
--   drop trigger inventory_sync_products_quantity on public.inventory;
--   drop trigger products_sync_inventory_shop on public.products;
--   drop trigger products_seed_inventory on public.products;
--   drop function public.restock_on_order_cancel();
--   drop function public.sync_products_quantity_from_inventory();
--   drop function public.sync_inventory_shop_id();
--   drop function public.seed_inventory_for_product();
--   drop function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text);
--   -- restore create_order's previous body from 20260802000100_initial_schema.sql
--   drop table public.stock_adjustments;
--   drop table public.inventory;
--   drop type public.stock_adjustment_reason;
--   revoke update (seller_id, shop_id, category_id, title, slug, description,
--     price_cents, currency, condition, status, featured, location, tags,
--     views_count, published_at) on public.products from authenticated;
--   grant update on public.products to authenticated;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Enumerated type
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.stock_adjustment_reason as enum (
    'initial_stock', 'restock', 'correction', 'sale', 'cancellation_restock',
    'shrinkage', 'other'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- inventory
--
-- One row per product (1:1 today — matches the ARCHITECTURE.md ERD's
-- `products ||--o{ inventory` shape while leaving room for a future
-- multi-location model without a breaking change). `shop_id` is a
-- denormalized copy of `products.shop_id`, kept in sync by
-- `products_sync_inventory_shop` below — this is what lets RLS scope
-- inventory rows with a direct column comparison instead of a join on every
-- read.
-- -----------------------------------------------------------------------------
create table public.inventory (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete cascade,
  shop_id               uuid references public.shops (id),

  quantity              integer not null default 0,
  low_stock_threshold   integer not null default 5,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint inventory_product_id_key unique (product_id),
  constraint inventory_quantity_non_negative check (quantity >= 0),
  constraint inventory_low_stock_threshold_non_negative check (low_stock_threshold >= 0)
);

comment on table public.inventory is
  'Per-product stock level. Source of truth for quantity; products.quantity is a synced mirror — see inventory_sync_products_quantity.';

create index inventory_shop_id_idx on public.inventory (shop_id);

create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- stock_adjustments
--
-- Append-only audit log — no UPDATE/DELETE policy, same "financial rows are
-- immutable" precedent already applied to orders/payments. `shop_id` is a
-- snapshot at write time (not synced), matching order_items' snapshot
-- philosophy: a historical row describes what was true when it happened.
-- -----------------------------------------------------------------------------
create table public.stock_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  shop_id             uuid references public.shops (id),

  delta               integer not null,
  previous_quantity   integer not null,
  new_quantity        integer not null,
  reason              public.stock_adjustment_reason not null,
  note                text,
  -- Set for 'sale' / 'cancellation_restock'; null for manual adjustments.
  related_order_id    uuid references public.orders (id) on delete set null,
  -- Null = system-driven (sale decrement, cancellation restock); set = a
  -- human's manual adjustment (seller/admin, or the seller who created the
  -- product for its 'initial_stock' row).
  created_by          uuid references public.profiles (id) on delete set null,

  created_at          timestamptz not null default now(),

  constraint stock_adjustments_delta_nonzero check (delta <> 0),
  constraint stock_adjustments_previous_non_negative check (previous_quantity >= 0),
  constraint stock_adjustments_new_non_negative check (new_quantity >= 0),
  constraint stock_adjustments_delta_matches check (new_quantity = previous_quantity + delta),
  constraint stock_adjustments_note_length check (note is null or char_length(note) <= 500)
);

comment on table public.stock_adjustments is
  'Append-only stock movement history. No UPDATE/DELETE policy — immutable, mirrors payments/orders.';

create index stock_adjustments_product_id_created_idx
  on public.stock_adjustments (product_id, created_at desc);
create index stock_adjustments_shop_id_created_idx
  on public.stock_adjustments (shop_id, created_at desc);
create index stock_adjustments_related_order_id_idx
  on public.stock_adjustments (related_order_id);


-- -----------------------------------------------------------------------------
-- Trigger: seed inventory the instant a product exists. Makes "every product
-- has exactly one inventory row" a DB-enforced invariant — no application
-- code changes needed for product creation (createProduct in queries.ts is
-- untouched).
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
  on conflict (product_id) do nothing;

  -- delta <> 0 is a hard constraint on stock_adjustments; a brand-new
  -- zero-stock draft has nothing to log yet.
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

create trigger products_seed_inventory
  after insert on public.products
  for each row execute function public.seed_inventory_for_product();


-- -----------------------------------------------------------------------------
-- Trigger: keep inventory.shop_id in sync when a product is (re)assigned to
-- a shop (covers assignProductShopAction and any future shop reassignment).
-- -----------------------------------------------------------------------------
create or replace function public.sync_inventory_shop_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shop_id is distinct from old.shop_id then
    update public.inventory
    set shop_id = new.shop_id
    where product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger products_sync_inventory_shop
  after update of shop_id on public.products
  for each row execute function public.sync_inventory_shop_id();


-- -----------------------------------------------------------------------------
-- Trigger: mirror inventory.quantity back onto products.quantity, and flip
-- status symmetrically with create_order's existing zero-stock rule. SECURITY
-- DEFINER is required: this issues a genuine second UPDATE statement against
-- products.quantity, a column authenticated no longer has UPDATE privilege on
-- (see the REVOKE near the bottom of this file) — the function must run as
-- its owner to write it.
-- -----------------------------------------------------------------------------
create or replace function public.sync_products_quantity_from_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger inventory_sync_products_quantity
  after update of quantity on public.inventory
  for each row execute function public.sync_products_quantity_from_inventory();


-- -----------------------------------------------------------------------------
-- Trigger: restock every line item of an order the instant it transitions to
-- 'cancelled'. Fully additive at the DB layer — cancelBuyerOrder/
-- order.actions.ts are unchanged; this covers that call site and any future
-- seller/admin cancellation path automatically.
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
    select product_id, quantity
    from public.order_items
    where order_id = new.id
  loop
    select * into v_inventory
    from public.inventory
    where product_id = v_item.product_id
    for update;

    if not found then
      -- Defensive only: every product has an inventory row via the seed
      -- trigger, so this should be unreachable.
      continue;
    end if;

    update public.inventory
    set quantity = v_inventory.quantity + v_item.quantity
    where id = v_inventory.id;

    insert into public.stock_adjustments (
      product_id, shop_id, delta, previous_quantity, new_quantity, reason,
      note, related_order_id, created_by
    )
    values (
      v_item.product_id, v_inventory.shop_id, v_item.quantity,
      v_inventory.quantity, v_inventory.quantity + v_item.quantity,
      'cancellation_restock', 'Restocked from cancelled order ' || new.order_number,
      new.id, null
    );
  end loop;

  return new;
end;
$$;

create trigger orders_restock_on_cancel
  after update of order_status on public.orders
  for each row
  when (new.order_status = 'cancelled' and old.order_status is distinct from 'cancelled')
  execute function public.restock_on_order_cancel();


-- -----------------------------------------------------------------------------
-- RPC: adjust_stock — the sole write path for manual stock changes (restock/
-- correction/shrinkage/other) from the Inventory dashboard. Mirrors
-- create_order's/verify_payment's chokepoint philosophy: no direct
-- INSERT/UPDATE grant is opened on `inventory` for authenticated. Explicitly
-- re-derives and checks authorization inside the function — never trusts RLS
-- alone, matching verify_payment's explicit-check style.
-- -----------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     public.stock_adjustment_reason,
  p_note       text default null
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
  -- lock ordering described at the top of this file.
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

  select * into v_inventory
  from public.inventory
  where product_id = p_product_id
  for update;

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
    product_id, shop_id, delta, previous_quantity, new_quantity, reason,
    note, created_by
  )
  values (
    p_product_id, v_inventory.shop_id, p_delta, v_previous_quantity,
    v_new_quantity, p_reason, p_note, v_uid
  );

  return v_inventory;
end;
$$;

comment on function public.adjust_stock is
  'Sole manual write path into inventory/stock_adjustments. Locks inventory before touching products (via the sync trigger) to match create_order''s lock order.';

revoke all on function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text)
  from public, anon;
grant execute on function public.adjust_stock(uuid, integer, public.stock_adjustment_reason, text)
  to authenticated;


-- -----------------------------------------------------------------------------
-- create_order — replaced in place (same signature/return shape, not a
-- breaking change to queries.createOrder/placeOrderAction). Locks inventory
-- before products (see note at top of file); decrements inventory instead of
-- products directly and logs a 'sale' stock_adjustments row.
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
  v_buyer_id  uuid := (select auth.uid());
  v_order     public.orders;
  v_item      jsonb;
  v_product   public.products;
  v_inventory public.inventory;
  v_quantity  integer;
  v_subtotal  integer := 0;
  v_currency  char(3);
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
  -- note at the top of this file.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be a positive integer'
        using errcode = '22023';
    end if;

    select * into v_inventory
    from public.inventory
    where product_id = (v_item ->> 'product_id')::uuid
    for update;

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

    v_subtotal := v_subtotal + (v_product.price_cents * v_quantity);
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

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_title, quantity,
      unit_price_cents, subtotal_cents
    )
    values (
      v_order.id, v_product.id, v_product.title, v_quantity,
      v_product.price_cents, v_product.price_cents * v_quantity
    );

    -- Row is already locked from the validation loop above; a plain re-select
    -- reads the same locked, still-consistent value.
    select * into v_inventory
    from public.inventory
    where product_id = v_product.id;

    -- Decrementing inventory (not products directly) is what
    -- inventory_sync_products_quantity mirrors back onto
    -- products.quantity/status.
    update public.inventory
    set quantity = v_inventory.quantity - v_quantity
    where product_id = v_product.id;

    insert into public.stock_adjustments (
      product_id, shop_id, delta, previous_quantity, new_quantity, reason,
      note, related_order_id, created_by
    )
    values (
      v_product.id, v_product.shop_id, -v_quantity, v_inventory.quantity,
      v_inventory.quantity - v_quantity, 'sale', 'Order ' || v_order.order_number,
      v_order.id, null
    );
  end loop;

  return v_order;
end;
$$;

comment on function public.create_order is
  'Atomically validates stock, creates an order with its items, and decrements inventory (products.quantity syncs via trigger).';


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select on public.inventory, public.stock_adjustments to authenticated;
-- No INSERT/UPDATE/DELETE grant on either table: every write goes through
-- the seed/sync/restock triggers or adjust_stock, all SECURITY DEFINER —
-- matches the payments table's zero-direct-grant precedent.

-- Close the direct write path onto products.quantity now that inventory is
-- the source of truth. Every other column stays exactly as updatable as
-- before (this is a column-level narrowing, not a table-level one).
revoke update on public.products from authenticated;
grant update (
  seller_id, shop_id, category_id, title, slug, description, price_cents,
  currency, condition, status, featured, location, tags, views_count,
  published_at
) on public.products to authenticated;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.inventory        enable row level security;
alter table public.stock_adjustments enable row level security;

create policy "shop members and admins read inventory"
  on public.inventory for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = inventory.product_id
        and (p.seller_id = (select auth.uid()) or public.is_shop_member(p.shop_id))
    )
  );

-- No INSERT/UPDATE/DELETE policy: see the grants comment above — writes are
-- RPC/trigger-only.

create policy "shop members and admins read stock history"
  on public.stock_adjustments for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = stock_adjustments.product_id
        and (p.seller_id = (select auth.uid()) or public.is_shop_member(p.shop_id))
    )
  );

-- No INSERT/UPDATE/DELETE policy: append-only, RPC/trigger-only writes.


-- -----------------------------------------------------------------------------
-- Idempotent backfill: one inventory row per existing product, plus one
-- 'initial_stock' history row per product with existing stock (delta <> 0 is
-- a hard constraint, so zero-stock products get an inventory row but no
-- history row — nothing happened yet). Safe to re-run: ON CONFLICT DO
-- NOTHING on the insert, and the history insert is guarded by a NOT EXISTS
-- check for a prior 'initial_stock' row per product.
-- -----------------------------------------------------------------------------
insert into public.inventory (product_id, shop_id, quantity)
select id, shop_id, quantity from public.products
on conflict (product_id) do nothing;

insert into public.stock_adjustments (
  product_id, shop_id, delta, previous_quantity, new_quantity, reason, note,
  created_by
)
select p.id, p.shop_id, p.quantity, 0, p.quantity, 'initial_stock',
       'Backfilled from products.quantity when the Inventory module was introduced',
       null
from public.products p
where p.quantity > 0
  and not exists (
    select 1 from public.stock_adjustments sa
    where sa.product_id = p.id and sa.reason = 'initial_stock'
  );

commit;
