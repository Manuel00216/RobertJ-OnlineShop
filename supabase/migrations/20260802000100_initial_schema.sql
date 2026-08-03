-- =============================================================================
-- Roberj Marketplace — initial schema
--
-- Idempotent and transactional: the whole file succeeds or rolls back.
-- Order: extensions -> enums -> functions -> tables -> indexes -> triggers
--        -> grants -> RLS policies.
-- =============================================================================

begin;

-- Defer function-body validation to commit time. Several SQL functions below
-- (e.g. current_user_role) reference tables created later in this same
-- transaction; with check_function_bodies on (the default) their CREATE would
-- fail on a forward reference even though every object exists by commit.
set local check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- pg_trgm powers substring search on product titles. A plain btree index cannot
-- serve `ilike '%term%'` (leading wildcard); a GIN trigram index can.
create extension if not exists pg_trgm with schema extensions;


-- -----------------------------------------------------------------------------
-- Enumerated types
--
-- Enums over text+CHECK: they generate exact TypeScript union types via
-- `supabase gen types`, and adding a value later is a cheap ALTER TYPE.
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('buyer', 'seller', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'sold', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Shared functions
--
-- Every function pins `search_path = ''` and fully qualifies identifiers.
-- Without this, a SECURITY DEFINER function can be hijacked by a caller who
-- puts a malicious schema earlier in their search_path.
-- -----------------------------------------------------------------------------

-- Maintains updated_at on any table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger function: stamps updated_at on UPDATE. Attach as BEFORE UPDATE FOR EACH ROW.';

-- Role lookup used by RLS policies.
--
-- SECURITY DEFINER is required, not optional: a policy ON public.profiles that
-- itself SELECTs public.profiles would recurse infinitely under RLS. A definer
-- function bypasses RLS for this single, tightly-scoped read.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

comment on function public.current_user_role is
  'Role of the calling user. SECURITY DEFINER to avoid RLS recursion on profiles.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- unaccent is not enabled by default on every project; degrade gracefully
-- rather than making the whole migration depend on it.
--
-- Must be declared BEFORE slugify(): Postgres validates SQL function bodies at
-- CREATE time (check_function_bodies is on by default), so a forward reference
-- aborts the migration.
create or replace function public.unaccent_fallback(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select value;
$$;

comment on function public.unaccent_fallback is
  'Identity passthrough. Swap for extensions.unaccent(value) if the unaccent extension is enabled.';

-- Deterministic, URL-safe slug.
create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;


-- -----------------------------------------------------------------------------
-- profiles
--
-- 1:1 with auth.users. We do NOT duplicate email here: auth.users owns it, and
-- copying it creates a second source of truth that silently drifts on email
-- change. Read it from the session instead.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'buyer',
  full_name   text,
  username    text,
  avatar_url  text,
  phone       text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_full_name_length
    check (full_name is null or char_length(full_name) between 1 and 120),
  constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 500),
  constraint profiles_avatar_url_scheme
    check (avatar_url is null or avatar_url ~ '^https?://'),
  constraint profiles_phone_format
    check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$')
);

comment on table public.profiles is
  'Public-facing user profile, 1:1 with auth.users. Email lives in auth.users only.';

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;


-- -----------------------------------------------------------------------------
-- categories
--
-- parent_id supports unlimited nesting. Depth is intentionally not constrained
-- in the schema; enforce presentation depth in the application.
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories (id) on delete set null,
  name        text not null,
  slug        text not null,
  description text,
  icon        text,
  image_url   text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_slug_key unique (slug),
  constraint categories_name_length check (char_length(name) between 1 and 80),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  constraint categories_image_url_scheme
    check (image_url is null or image_url ~ '^https?://')
);

comment on table public.categories is
  'Product taxonomy. Self-referencing for unlimited nesting; admin-managed.';


-- -----------------------------------------------------------------------------
-- products
--
-- Money is stored as integer minor units (centavos), never float or numeric.
-- See docs/database.md for the rationale.
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles (id) on delete cascade,
  category_id   uuid references public.categories (id) on delete set null,

  title         text not null,
  slug          text not null,
  description   text,

  price_cents   integer not null,
  currency      char(3) not null default 'PHP',

  quantity      integer not null default 0,
  condition     public.product_condition not null default 'new',
  status        public.product_status not null default 'draft',
  featured      boolean not null default false,

  location      text,
  tags          text[] not null default '{}',

  views_count   integer not null default 0,

  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint products_slug_key unique (slug),
  constraint products_title_length check (char_length(title) between 2 and 160),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_description_length
    check (description is null or char_length(description) <= 5000),
  constraint products_price_positive check (price_cents > 0),
  constraint products_price_sane check (price_cents <= 100000000000),
  constraint products_quantity_non_negative check (quantity >= 0),
  constraint products_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint products_views_non_negative check (views_count >= 0),
  constraint products_tags_bounded check (cardinality(tags) <= 20),
  -- An active listing must be purchasable and must have a publish timestamp.
  constraint products_active_requires_stock
    check (status <> 'active' or quantity > 0),
  constraint products_active_requires_published_at
    check (status <> 'active' or published_at is not null)
);

comment on table public.products is
  'Marketplace listings. price_cents is integer minor units; see docs/database.md.';
comment on column public.products.price_cents is
  'Price in minor units (centavos). 199.50 PHP is stored as 19950.';


-- -----------------------------------------------------------------------------
-- product_images
--
-- Deliberately a table, not a text[] column on products. Ordering, alt text
-- (accessibility), and per-image metadata are first-class needs, and arrays
-- cannot be indexed or constrained per element.
-- -----------------------------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint product_images_url_scheme check (url ~ '^https?://'),
  constraint product_images_alt_length
    check (alt_text is null or char_length(alt_text) <= 200),
  constraint product_images_sort_non_negative check (sort_order >= 0),
  constraint product_images_unique_position unique (product_id, sort_order)
);

comment on table public.product_images is
  'Ordered images for a product. sort_order 0 is the primary/cover image.';


-- -----------------------------------------------------------------------------
-- orders
--
-- One order belongs to exactly one seller. A multi-seller cart is split into
-- one order per seller at checkout. See docs/database.md — this is the single
-- most consequential design decision in this schema.
--
-- The shipping address is denormalised into jsonb on purpose: an order is a
-- financial record and must not mutate when the user later edits their saved
-- address.
-- -----------------------------------------------------------------------------
create sequence if not exists public.order_number_seq as bigint start 1;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null,

  buyer_id           uuid not null references public.profiles (id) on delete restrict,
  seller_id          uuid not null references public.profiles (id) on delete restrict,

  subtotal_cents     integer not null,
  shipping_fee_cents integer not null default 0,
  total_cents        integer not null,
  currency           char(3) not null default 'PHP',

  payment_status     public.payment_status not null default 'pending',
  order_status       public.order_status not null default 'pending',

  shipping_address   jsonb not null,
  notes              text,

  placed_at          timestamptz not null default now(),
  paid_at            timestamptz,
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint orders_order_number_key unique (order_number),
  constraint orders_buyer_is_not_seller check (buyer_id <> seller_id),
  constraint orders_subtotal_non_negative check (subtotal_cents >= 0),
  constraint orders_shipping_non_negative check (shipping_fee_cents >= 0),
  constraint orders_total_matches check (total_cents = subtotal_cents + shipping_fee_cents),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint orders_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint orders_shipping_address_is_object
    check (jsonb_typeof(shipping_address) = 'object'),
  -- Required address keys, validated here so no code path can write a partial
  -- address that later breaks fulfilment.
  constraint orders_shipping_address_required_keys
    check (shipping_address ?& array['full_name', 'line1', 'city', 'postal_code', 'country']),
  constraint orders_paid_at_requires_paid
    check (paid_at is null or payment_status in ('paid', 'refunded', 'partially_refunded'))
);

comment on table public.orders is
  'One order per seller. Multi-seller carts split at checkout — see docs/database.md.';
comment on column public.orders.shipping_address is
  'Immutable snapshot. Never a foreign key to a mutable address record.';


-- -----------------------------------------------------------------------------
-- order_items
--
-- unit_price_cents and title are snapshots taken at purchase time. A seller
-- editing or deleting a listing must never rewrite historical order totals,
-- which is also why product_id is ON DELETE RESTRICT rather than CASCADE.
-- -----------------------------------------------------------------------------
create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid not null references public.products (id) on delete restrict,

  product_title    text not null,
  quantity         integer not null,
  unit_price_cents integer not null,
  subtotal_cents   integer not null,
  created_at       timestamptz not null default now(),

  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_positive check (unit_price_cents > 0),
  constraint order_items_subtotal_matches
    check (subtotal_cents = unit_price_cents * quantity),
  constraint order_items_unique_product_per_order unique (order_id, product_id)
);

comment on table public.order_items is
  'Line items with price/title snapshotted at purchase. product_id is RESTRICT to protect history.';


-- -----------------------------------------------------------------------------
-- Full-text search
--
-- The two-argument to_tsvector(regconfig, text) form is IMMUTABLE, which is
-- required for a generated column. The one-argument form is not.
-- -----------------------------------------------------------------------------
alter table public.products
  drop column if exists search_vector;

alter table public.products
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;


-- -----------------------------------------------------------------------------
-- Indexes
--
-- Every foreign key gets an index: Postgres does NOT create one automatically,
-- and an unindexed FK makes parent deletes and joins seq-scan the child table.
-- -----------------------------------------------------------------------------

-- categories
create index if not exists categories_parent_id_idx on public.categories (parent_id);
create index if not exists categories_active_sort_idx
  on public.categories (sort_order, name) where active;

-- products
create index if not exists products_seller_id_idx on public.products (seller_id);
create index if not exists products_category_id_idx on public.products (category_id);

-- The storefront's hot path: active products, newest first. Partial, so the
-- index only carries live rows instead of every draft and archived listing.
create index if not exists products_active_recent_idx
  on public.products (created_at desc)
  where status = 'active';

-- Browsing a category, and sorting by price within it.
create index if not exists products_active_category_created_idx
  on public.products (category_id, created_at desc)
  where status = 'active';
create index if not exists products_active_price_idx
  on public.products (price_cents)
  where status = 'active';

-- A seller's own inventory screen.
create index if not exists products_seller_status_created_idx
  on public.products (seller_id, status, created_at desc);

create index if not exists products_featured_idx
  on public.products (created_at desc)
  where featured and status = 'active';

-- Substring search (`ilike '%term%'`) and tag filtering.
create index if not exists products_title_trgm_idx
  on public.products using gin (title extensions.gin_trgm_ops);
create index if not exists products_tags_idx
  on public.products using gin (tags);
create index if not exists products_search_vector_idx
  on public.products using gin (search_vector);

-- product_images
create index if not exists product_images_product_id_sort_idx
  on public.product_images (product_id, sort_order);

-- orders
create index if not exists orders_buyer_id_created_idx
  on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_id_created_idx
  on public.orders (seller_id, created_at desc);
create index if not exists orders_order_status_idx on public.orders (order_status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

-- order_items
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- updated_at maintenance
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- Auto-create a profile on signup.
--
-- Wrapped in an exception handler on purpose: an unhandled error in this
-- trigger aborts the INSERT into auth.users, which means the user cannot sign
-- up at all. A missing profile is recoverable; a broken signup flow is not.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
begin
  candidate_username := public.slugify(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    )
  );
  candidate_username := replace(candidate_username, '-', '_');

  -- Fall back to null rather than colliding on the unique index.
  if candidate_username !~ '^[a-z0-9_]{3,30}$'
     or exists (select 1 from public.profiles p where lower(p.username) = candidate_username)
  then
    candidate_username := null;
  end if;

  insert into public.profiles (id, full_name, username, avatar_url, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    candidate_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
    'buyer'
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Order number generation.
--
-- Uses a real sequence. A `select max(...) + 1` approach races under
-- concurrency and produces duplicates; nextval() is atomic and never blocks.
create or replace function public.assign_order_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'ORD-'
      || to_char(now() at time zone 'utc', 'YYYYMMDD')
      || '-'
      || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_order_number on public.orders;
create trigger orders_assign_order_number
  before insert on public.orders
  for each row execute function public.assign_order_number();


-- Timestamp the payment/fulfilment lifecycle transitions.
create or replace function public.track_order_status_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  if new.order_status = 'shipped' and old.order_status is distinct from 'shipped' then
    new.shipped_at := coalesce(new.shipped_at, now());
  end if;

  if new.order_status = 'delivered' and old.order_status is distinct from 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  if new.order_status = 'cancelled' and old.order_status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists orders_track_status_timestamps on public.orders;
create trigger orders_track_status_timestamps
  before update on public.orders
  for each row execute function public.track_order_status_timestamps();


-- Stamp published_at the first time a product goes active.
create or replace function public.track_product_published_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_track_published_at on public.products;
create trigger products_track_published_at
  before insert or update on public.products
  for each row execute function public.track_product_published_at();


-- -----------------------------------------------------------------------------
-- Checkout RPC
--
-- Stock decrement and order creation must be one atomic unit. Doing this from
-- application code cannot be made safe: two buyers can both read quantity = 1
-- and both succeed. The `for update` row lock here serialises them.
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
-- SECURITY DEFINER is mandatory here. The buyer must decrement the seller's
-- stock, which the products UPDATE policy forbids. Authorisation is therefore
-- enforced explicitly below: buyer_id is taken from auth.uid() and never from
-- a parameter, so the caller cannot place an order as someone else.
security definer
set search_path = ''
as $$
declare
  v_buyer_id  uuid := (select auth.uid());
  v_order     public.orders;
  v_item      jsonb;
  v_product   public.products;
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
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be a positive integer'
        using errcode = '22023';
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

    if v_product.quantity < v_quantity then
      raise exception 'Only % left of %', v_product.quantity, v_product.title
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

    update public.products
    set quantity = quantity - v_quantity,
        status   = case when quantity - v_quantity = 0 then 'sold'::public.product_status
                        else status end
    where id = v_product.id;
  end loop;

  return v_order;
end;
$$;

comment on function public.create_order is
  'Atomically validates stock, creates an order with its items, and decrements inventory.';


-- -----------------------------------------------------------------------------
-- Grants
--
-- RLS is the access control mechanism; these grants only make the tables
-- reachable so policies can be evaluated. Without RLS enabled below, these
-- grants alone would be wide open — the two must always ship together.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.categories, public.products, public.product_images
  to anon, authenticated;

grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.products, public.product_images to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;

grant usage on sequence public.order_number_seq to authenticated;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Two conventions used throughout:
--   1. `(select auth.uid())` rather than bare `auth.uid()`. The subquery form
--      is evaluated once per statement instead of once per row — a large
--      difference on any query returning more than a handful of rows.
--   2. Policies are scoped `to anon` / `to authenticated` rather than left
--      unscoped, so Postgres skips policies that cannot apply to the caller.
-- -----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- Deny by default: no FORCE bypass for table owners is needed, but be explicit
-- that service_role intentionally bypasses RLS entirely.

-- ---------- profiles ----------
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Note: no UPDATE policy grants role changes to the user. Privilege escalation
-- is prevented by the trigger below, since a WITH CHECK clause cannot compare
-- against the row's previous value.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Same reasoning as enforce_order_update_rules: a null auth.uid() is a
  -- trusted server context, not an end user escalating themselves.
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin()
  then
    raise exception 'Only an administrator may change a user role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---------- categories ----------
drop policy if exists "active categories are publicly readable" on public.categories;
create policy "active categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (active or public.is_admin());

drop policy if exists "admins insert categories" on public.categories;
create policy "admins insert categories"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update categories" on public.categories;
create policy "admins update categories"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete categories" on public.categories;
create policy "admins delete categories"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- ---------- products ----------
drop policy if exists "active products are publicly readable" on public.products;
create policy "active products are publicly readable"
  on public.products for select
  to anon
  using (status = 'active');

drop policy if exists "buyers read active products, sellers read their own" on public.products;
create policy "buyers read active products, sellers read their own"
  on public.products for select
  to authenticated
  using (
    status = 'active'
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists "sellers insert their own products" on public.products;
create policy "sellers insert their own products"
  on public.products for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and public.current_user_role() in ('seller', 'admin')
  );

drop policy if exists "sellers update their own products" on public.products;
create policy "sellers update their own products"
  on public.products for update
  to authenticated
  using (seller_id = (select auth.uid()) or public.is_admin())
  with check (seller_id = (select auth.uid()) or public.is_admin());

drop policy if exists "sellers delete their own products" on public.products;
create policy "sellers delete their own products"
  on public.products for delete
  to authenticated
  using (seller_id = (select auth.uid()) or public.is_admin());

-- ---------- product_images ----------
-- Authorisation is derived from the parent product, never duplicated.
drop policy if exists "product images follow product visibility" on public.product_images;
create policy "product images follow product visibility"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (p.status = 'active' or p.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "sellers insert images for their products" on public.product_images;
create policy "sellers insert images for their products"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = (select auth.uid())
    )
  );

drop policy if exists "sellers update images for their products" on public.product_images;
create policy "sellers update images for their products"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = (select auth.uid())
    )
  );

drop policy if exists "sellers delete images for their products" on public.product_images;
create policy "sellers delete images for their products"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = (select auth.uid())
    )
  );

-- ---------- orders ----------
-- Because seller_id lives on the order itself, "sellers see orders containing
-- their products" is a single indexed equality check rather than a correlated
-- subquery against order_items on every row.
drop policy if exists "buyers and sellers read their own orders" on public.orders;
create policy "buyers and sellers read their own orders"
  on public.orders for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists "buyers create their own orders" on public.orders;
create policy "buyers create their own orders"
  on public.orders for insert
  to authenticated
  with check (buyer_id = (select auth.uid()) and buyer_id <> seller_id);

-- Both parties may update, but each is limited to their own side of the
-- lifecycle by the trigger below — RLS alone cannot express column-level rules.
drop policy if exists "buyers and sellers update their own orders" on public.orders;
create policy "buyers and sellers update their own orders"
  on public.orders for update
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_admin()
  )
  with check (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

-- No DELETE policy on orders at all: financial records are never destroyed,
-- they are cancelled. The absence of a policy denies every delete.

create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- A null auth.uid() means there is no end-user JWT on this request: the
  -- caller is service_role, a webhook, a cron job, or the SQL editor. Triggers
  -- are NOT bypassed by service_role (only RLS is), so without this branch a
  -- payment webhook could never mark an order paid.
  if v_uid is null or public.is_admin() then
    return new;
  end if;

  -- Immutable financial and identity fields.
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

  -- Only the seller advances fulfilment.
  if new.order_status is distinct from old.order_status
     and v_uid <> old.seller_id
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  -- Payment status is never client-driven. It is set by the payment webhook,
  -- which reaches the early return above because it carries no end-user JWT.
  if new.payment_status is distinct from old.payment_status then
    raise exception 'Payment status is set by the payment provider only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_update_rules on public.orders;
create trigger orders_enforce_update_rules
  before update on public.orders
  for each row execute function public.enforce_order_update_rules();

-- ---------- order_items ----------
-- Every rule is derived from the parent order. There is no path by which a
-- user can read an item belonging to someone else's order.
drop policy if exists "order items follow parent order" on public.order_items;
create policy "order items follow parent order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.buyer_id = (select auth.uid())
          or o.seller_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );

drop policy if exists "buyers insert items into their own orders" on public.order_items;
create policy "buyers insert items into their own orders"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = (select auth.uid())
    )
  );

-- No UPDATE or DELETE policy: line items are immutable once written.

commit;
