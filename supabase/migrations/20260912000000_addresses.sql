-- =============================================================================
-- Saved Address Book (Phase 2 of the buyer checkout improvement work).
--
-- A plain-RLS, non-RPC-gated user-owned table — same justification as
-- `wishlists` (20260821000000_wishlists.sql): every write here is a pure
-- `user_id`-owned row with no cross-entity invariant (stock, money, role) to
-- protect, so a `user_id = auth.uid()` RLS policy gives exactly the
-- guarantee an RPC would, with far less code. The one cross-row concern —
-- "at most one default address per user" — is handled by a DB trigger +
-- partial unique index below, not an RPC, since it's still scoped entirely
-- to the row owner.
--
-- `orders.shipping_address` stays an immutable jsonb snapshot, completely
-- unchanged by this migration — its CHECK constraint only requires the keys
-- full_name/line1/city/postal_code/country to be *present*
-- (`?& array[...]`), not that the object contains *only* those keys, so the
-- checkout can carry region/province/barangay through as additional jsonb
-- keys on the snapshot with zero change to `orders` or `create_order`.
--
-- Region/Province/Barangay are plain text, not validated against a PH
-- location reference dataset — deliberately out of scope for this phase.
--
-- ROLLBACK:
--   drop table public.addresses;
-- =============================================================================

begin;

create table public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,

  label           text not null default 'Home',
  recipient_name  text not null,
  phone           text not null,

  region          text,
  province        text,
  city            text not null,
  barangay        text,
  street_details  text not null,
  postal_code     text not null,
  country         text not null default 'Philippines',

  is_default      boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint addresses_label_length
    check (char_length(label) between 1 and 40),
  constraint addresses_recipient_name_length
    check (char_length(recipient_name) between 2 and 120),
  constraint addresses_phone_format
    check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  constraint addresses_region_length
    check (region is null or char_length(region) <= 120),
  constraint addresses_province_length
    check (province is null or char_length(province) <= 120),
  constraint addresses_city_length
    check (char_length(city) between 1 and 120),
  constraint addresses_barangay_length
    check (barangay is null or char_length(barangay) <= 120),
  constraint addresses_street_details_length
    check (char_length(street_details) between 1 and 160),
  constraint addresses_postal_code_length
    check (char_length(postal_code) between 1 and 20)
);

comment on table public.addresses is
  'Buyer-saved shipping addresses. Plain RLS-scoped to auth.uid(), no RPC — see this migration''s header for why. orders.shipping_address remains an immutable jsonb snapshot, never a foreign key here.';

-- Only one default address per user, enforced atomically at the DB layer.
create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create index addresses_user_id_idx on public.addresses (user_id);

-- Reuses the existing shared trigger function (defined in the initial schema).
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Setting a row's is_default = true atomically unsets any other default for
-- that same user first, so the partial unique index above is always
-- satisfiable from a single client statement — no client-side two-request
-- "unset old, then set new" race.
create or replace function public.addresses_enforce_single_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row execute function public.addresses_enforce_single_default();

-- -----------------------------------------------------------------------------
-- RLS: a user manages only their own address rows. No admin/seller override —
-- an address book is private to its owner, unlike orders/products.
-- -----------------------------------------------------------------------------
alter table public.addresses enable row level security;

create policy "users read their own addresses"
  on public.addresses for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users add their own addresses"
  on public.addresses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their own addresses"
  on public.addresses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete their own addresses"
  on public.addresses for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.addresses from anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

commit;
