-- =============================================================================
-- Seller hard delete support — permanently removing a test/deactivated seller
-- account (auth.users + profiles) while preserving every historical order,
-- order_item, payment, return_request, and shop it ever touched.
--
-- Problem: `profiles.id references auth.users(id) on delete cascade`, and
-- from there:
--   * `products.seller_id`/`product_variants.seller_id` are `on delete
--     cascade` — deleting the profile tries to delete the seller's products
--     too, which `order_items.product_id on delete restrict` then blocks,
--     failing the WHOLE delete (protective, but means a seller with any
--     order history can never be removed at all today).
--   * `orders.seller_id` (`restrict`), `return_requests.seller_id`/
--     `seller_decided_by` (`no action`, i.e. restrict), and
--     `order_shipments.seller_id` (`no action`) block it outright even
--     before reaching products.
--
-- Fix, deliberately narrow — only the columns live data actually blocks on
-- (verified against production before writing this: `payments.verified_by`,
-- `product_variants.seller_id`, `recommendation_rules.seller_id` currently
-- have zero rows for the accounts this unblocks, so they are left exactly as
-- they are — not "future-proofed" for a case that doesn't exist yet):
--   * `products.seller_id`: cascade -> set null, drop not null. The product
--     itself is never deleted (order_items still needs it) — it survives
--     with no seller, which the existing `create_order` H1 guard
--     (`where id = p_seller_id and is_active`) already refuses to sell
--     against (`id = null` matches nothing) — no new exposure, since that
--     guard already blocks these specific products today (their accounts
--     are already `is_active = false`).
--   * `orders.seller_id`, `return_requests.seller_id`,
--     `return_requests.seller_decided_by`, `order_shipments.seller_id`:
--     restrict/no action -> set null (dropping not null on the three that
--     have it). The order/return/shipment row is never touched otherwise —
--     only the now-gone seller's identity reference clears.
--
-- Historical attribution: no new table. `admin_action_log` already exists
-- (20260816000000), already has `target_user_id uuid ... on delete set
-- null` and an untyped `metadata jsonb` column immune to any cascade — it is
-- the existing "high-stakes admin action" audit trail. A snapshot (email,
-- full_name, username, previous role, shop) written there before deletion
-- IS the "former seller" record; the UI-facing "Former Seller" label itself
-- is a display-layer fallback (queries.ts), not a schema concern.
--
-- RPC: admin_hard_delete_seller_account — mirrors admin_demote_seller_to_buyer's
-- shape (explicit is_admin() check, one transaction, one admin_action_log
-- row). Requires the account to already be deactivated (`is_active = false`)
-- so a live seller can never be hard-deleted by accident — deactivation via
-- `admin_set_user_active` must happen first, exactly like today's demote
-- flow requires no special precondition but hard-delete is one-way, so this
-- one does. Does NOT delete auth.users itself (no precedent for raw SQL
-- against auth.users in this codebase — see scripts/e2e-oauth-profile-trigger.mjs
-- for the established Admin API pattern); the caller invokes
-- supabase.auth.admin.deleteUser(id) immediately after this RPC returns,
-- inside the same operation.
--
-- ROLLBACK:
--   revoke execute on function public.admin_hard_delete_seller_account(uuid, text) from authenticated;
--   drop function public.admin_hard_delete_seller_account(uuid, text);
--   alter table public.order_shipments drop constraint order_shipments_seller_id_fkey;
--   alter table public.order_shipments alter column seller_id set not null;
--   alter table public.order_shipments add constraint order_shipments_seller_id_fkey foreign key (seller_id) references public.profiles (id);
--   alter table public.return_requests drop constraint return_requests_seller_decided_by_fkey;
--   alter table public.return_requests add constraint return_requests_seller_decided_by_fkey foreign key (seller_decided_by) references public.profiles (id);
--   alter table public.return_requests drop constraint return_requests_seller_id_fkey;
--   alter table public.return_requests alter column seller_id set not null;
--   alter table public.return_requests add constraint return_requests_seller_id_fkey foreign key (seller_id) references public.profiles (id);
--   alter table public.orders drop constraint orders_seller_id_fkey;
--   alter table public.orders alter column seller_id set not null;
--   alter table public.orders add constraint orders_seller_id_fkey foreign key (seller_id) references public.profiles (id) on delete restrict;
--   alter table public.products drop constraint products_seller_id_fkey;
--   alter table public.products alter column seller_id set not null;
--   alter table public.products add constraint products_seller_id_fkey foreign key (seller_id) references public.profiles (id) on delete cascade;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- products.seller_id: cascade -> set null. Survives seller deletion so
-- order_items keeps a valid product to point at.
-- -----------------------------------------------------------------------------
alter table public.products drop constraint products_seller_id_fkey;
alter table public.products alter column seller_id drop not null;
alter table public.products
  add constraint products_seller_id_fkey
  foreign key (seller_id) references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- orders.seller_id: restrict -> set null. The order itself is never touched.
-- -----------------------------------------------------------------------------
alter table public.orders drop constraint orders_seller_id_fkey;
alter table public.orders alter column seller_id drop not null;
alter table public.orders
  add constraint orders_seller_id_fkey
  foreign key (seller_id) references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- return_requests.seller_id / seller_decided_by: no action -> set null.
-- -----------------------------------------------------------------------------
alter table public.return_requests drop constraint return_requests_seller_id_fkey;
alter table public.return_requests alter column seller_id drop not null;
alter table public.return_requests
  add constraint return_requests_seller_id_fkey
  foreign key (seller_id) references public.profiles (id) on delete set null;

alter table public.return_requests drop constraint return_requests_seller_decided_by_fkey;
alter table public.return_requests
  add constraint return_requests_seller_decided_by_fkey
  foreign key (seller_decided_by) references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- order_shipments.seller_id: no action -> set null.
-- -----------------------------------------------------------------------------
alter table public.order_shipments drop constraint order_shipments_seller_id_fkey;
alter table public.order_shipments alter column seller_id drop not null;
alter table public.order_shipments
  add constraint order_shipments_seller_id_fkey
  foreign key (seller_id) references public.profiles (id) on delete set null;


-- -----------------------------------------------------------------------------
-- RPC: admin_hard_delete_seller_account — sole pre-delete bookkeeping step.
-- Admin-only, refuses an admin target, requires the account already
-- deactivated. Snapshots identity into admin_action_log, clears any stray
-- shop_users row, and returns the snapshot. Does not touch auth.users.
-- -----------------------------------------------------------------------------
create or replace function public.admin_hard_delete_seller_account(
  p_user_id uuid,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_profile   public.profiles;
  v_email     text;
  v_shop_id   uuid;
  v_shop_name text;
  v_summary   jsonb;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to delete this account'
      using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_profile.role = 'admin' then
    raise exception 'Cannot hard-delete an administrator account' using errcode = '22023';
  end if;

  if v_profile.is_active then
    raise exception 'Deactivate this account before permanently deleting it'
      using errcode = '22023';
  end if;

  if p_reason is not null and char_length(p_reason) > 200 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  select su.shop_id, s.name into v_shop_id, v_shop_name
  from public.shop_users su
  join public.shops s on s.id = su.shop_id
  where su.user_id = p_user_id;

  delete from public.shop_users where user_id = p_user_id;

  v_summary := jsonb_build_object(
    'email', v_email,
    'full_name', v_profile.full_name,
    'username', v_profile.username,
    'previous_role', v_profile.role,
    'shop_id', v_shop_id,
    'shop_name', v_shop_name,
    'reason', p_reason
  );

  insert into public.admin_action_log (
    actor_id, action, target_user_id, target_shop_id, metadata
  )
  values (
    v_uid, 'hard_delete_seller_account', p_user_id, v_shop_id, v_summary
  );

  return v_summary;
end;
$$;

comment on function public.admin_hard_delete_seller_account is
  'Admin-only pre-delete bookkeeping for permanently removing a deactivated seller/buyer account: snapshots identity into admin_action_log (the "former seller" record), clears any stray shop_users row. Caller must already have deactivated the account, and must call supabase.auth.admin.deleteUser(id) immediately after this returns — this function never touches auth.users.';

revoke all on function public.admin_hard_delete_seller_account(uuid, text) from public, anon;
grant execute on function public.admin_hard_delete_seller_account(uuid, text) to authenticated;

commit;
