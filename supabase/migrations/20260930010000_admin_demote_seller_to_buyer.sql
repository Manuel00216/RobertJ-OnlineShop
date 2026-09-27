-- =============================================================================
-- Admin Users M3 — reversible Seller → Buyer demotion.
--
-- Symmetric with `admin_assign_seller_shop`'s promotion path
-- (20260816000000_admin_user_shop_management.sql): role change + shop_users
-- membership change + one `admin_action_log` row, in a single transaction.
-- Explicit `is_admin()` re-derived and checked inside the function — never
-- trusts RLS alone, same posture as every other admin RPC.
--
-- Deliberately narrow / non-destructive:
--  * Only a role = 'seller' target is accepted — an admin can never be
--    demoted this way (structurally impossible anyway: role is a single
--    column, so a caller can't be both), and a buyer target would be a
--    no-op that shouldn't silently succeed.
--  * Touches ONLY `profiles.role` and the `shop_users` row — `products` and
--    `orders` are never written. A demoted seller's historical
--    products/orders/shop data are kept exactly as they were (matching
--    `admin_set_user_active`'s "nothing is deleted" precedent) — this is
--    the same accepted edge already documented in
--    20260930000000_reject_orders_for_deactivated_seller.sql's note about
--    "a legacy product owned by a demoted-to-buyer account (TD-1)".
--  * Reversible: promoting the same account back to Seller via
--    `admin_assign_seller_shop` restores full seller capability. It does
--    NOT automatically restore their previous shop membership — the admin
--    must pick a shop again, identical to any other promotion.
--
-- ROLLBACK:
--   revoke execute on function public.admin_demote_seller_to_buyer(uuid) from authenticated;
--   drop function public.admin_demote_seller_to_buyer(uuid);
-- =============================================================================

begin;

create or replace function public.admin_demote_seller_to_buyer(
  p_user_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_profile   public.profiles;
  v_shop_id   uuid;
  v_shop_name text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to demote this account'
      using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_profile.role <> 'seller' then
    raise exception 'Only sellers can be demoted to buyer' using errcode = '22023';
  end if;

  select su.shop_id, s.name into v_shop_id, v_shop_name
  from public.shop_users su
  join public.shops s on s.id = su.shop_id
  where su.user_id = p_user_id;

  update public.profiles set role = 'buyer' where id = p_user_id;
  delete from public.shop_users where user_id = p_user_id;

  insert into public.admin_action_log (
    actor_id, action, target_user_id, target_shop_id, metadata
  )
  values (
    v_uid, 'demote_seller_to_buyer', p_user_id, v_shop_id,
    jsonb_build_object(
      'previous_role', 'seller',
      'new_role', 'buyer',
      'shop_id', v_shop_id,
      'shop_name', v_shop_name
    )
  );

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

comment on function public.admin_demote_seller_to_buyer is
  'Reversible sole write path for demoting a seller to buyer: role change + shop_users membership removal + admin_action_log row, one transaction. Never touches products/orders.';

revoke all on function public.admin_demote_seller_to_buyer(uuid) from public, anon;
grant execute on function public.admin_demote_seller_to_buyer(uuid) to authenticated;

commit;
