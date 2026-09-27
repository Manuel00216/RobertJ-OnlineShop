-- =============================================================================
-- Phase 4: admin_assign_seller_shop now also reassigns products.seller_id for
-- every product currently attributed to the shop, so a NEW order placed
-- after reassignment correctly attributes to the new seller at checkout
-- (create_order's p_seller_id comes from cart lines, which come from
-- products.seller_id — see docs/shop-continuity review). This is the ONLY
-- real data mutation in the whole plan; everything else this migration set
-- touched was additive schema/RLS/guard widening.
--
-- Deliberately narrow:
--  * Only products.seller_id is written. products.shop_id, orders,
--    inventory, and every other table are untouched by this function.
--  * Runs inside the function's existing single transaction, alongside the
--    already-atomic role change + shop_users delete-then-insert.
--  * products_reassigned_count is added to the existing admin_action_log
--    row's metadata (no new log row, no new table).
--  * No signature change (still admin_assign_seller_shop(uuid, uuid)) — safe
--    CREATE OR REPLACE in place.
-- =============================================================================

begin;

create or replace function public.admin_assign_seller_shop(
  p_user_id uuid,
  p_shop_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_profile        public.profiles;
  v_shop           public.shops;
  v_previous_role  public.user_role;
  v_products_reassigned bigint;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to assign a seller to a shop'
      using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_profile.role = 'admin' then
    raise exception 'Cannot assign a shop to an administrator' using errcode = '22023';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Shop not found' using errcode = 'P0002';
  end if;
  if not v_shop.active then
    raise exception 'Cannot assign a seller to an inactive shop' using errcode = '22023';
  end if;

  v_previous_role := v_profile.role;

  if v_profile.role = 'buyer' then
    update public.profiles set role = 'seller' where id = p_user_id;
  end if;

  -- Delete-then-insert: never a window with zero or two memberships, and
  -- makes this the sole path for both promotion and later reassignment.
  delete from public.shop_users where user_id = p_user_id;
  insert into public.shop_users (shop_id, user_id) values (p_shop_id, p_user_id);

  -- Reassign the shop's products to the new seller so future checkouts
  -- attribute correctly. Excludes p_user_id's own prior products (none,
  -- since they weren't a shop member before) — a plain WHERE shop_id match.
  update public.products
  set seller_id = p_user_id
  where shop_id = p_shop_id
    and seller_id <> p_user_id;
  get diagnostics v_products_reassigned = row_count;

  insert into public.admin_action_log (
    actor_id, action, target_user_id, target_shop_id, metadata
  )
  values (
    v_uid, 'assign_seller_shop', p_user_id, p_shop_id,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'new_role', 'seller',
      'shop_name', v_shop.name,
      'products_reassigned_count', v_products_reassigned
    )
  );

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

comment on function public.admin_assign_seller_shop is
  'Sole write path for promoting a buyer to seller and/or (re)assigning their shop_users membership. Atomically also reassigns the shop''s existing products.seller_id to the new seller (logged as products_reassigned_count) so new checkouts attribute correctly. Never leaves a seller without a shop.';

commit;
