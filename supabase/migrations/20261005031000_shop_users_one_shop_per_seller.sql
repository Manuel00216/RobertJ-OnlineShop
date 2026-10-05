-- =============================================================================
-- Seller audit fix #3 — enforce "one seller = one shop" at the database level.
--
-- `shop_users`' only existing unique constraint is (shop_id, user_id), which
-- permits one user belonging to multiple shops. Application code already
-- assumes the opposite everywhere a seller's "own shop" is resolved
-- (getOwnShopId's .maybeSingle(), report_sales_summary's `select ... into
-- v_caller_shop_id`, and every seller-scoped order/product/barcode query
-- built on top of them) — and admin_assign_seller_shop's own comment confirms
-- it already deliberately does "delete-then-insert: never a window with zero
-- or two memberships." This migration makes that already-enforced invariant
-- a real constraint instead of an assumption repeated in several places.
--
-- Verified safe to apply: no user_id currently appears more than once in
-- shop_users (checked live before writing this migration).
--
-- ROLLBACK:
--   alter table public.shop_users drop constraint shop_users_one_shop_per_user;
-- =============================================================================

begin;

alter table public.shop_users
  add constraint shop_users_one_shop_per_user unique (user_id);

commit;
