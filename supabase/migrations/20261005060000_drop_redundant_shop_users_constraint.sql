-- =============================================================================
-- Admin audit fix #6 — drop a redundant constraint introduced by mistake.
--
-- 20261005031000_shop_users_one_shop_per_seller.sql added
-- `shop_users_one_shop_per_user unique (user_id)`, believing no such
-- constraint existed. It was wrong: `20260816000000_admin_user_shop_
-- management.sql` already added the identical rule as `shop_users_unique_
-- user` back on 2026-08-16. Both constraints enforced the exact same thing,
-- so this was never a functional bug — just schema clutter from an
-- incomplete check (only duplicate ROWS were verified live before adding
-- the second one; the existing CONSTRAINT itself was never queried for).
--
-- Drops the newer, redundant one; keeps the original.
--
-- ROLLBACK:
--   alter table public.shop_users add constraint shop_users_one_shop_per_user unique (user_id);
-- =============================================================================

begin;

alter table public.shop_users drop constraint shop_users_one_shop_per_user;

commit;
