-- =============================================================================
-- Add covering indexes for foreign keys flagged by the Supabase performance
-- advisor as unindexed (audit finding F-D3). An FK without a covering index
-- forces a sequential scan on the referencing table whenever Postgres checks
-- the constraint on a referenced-row UPDATE/DELETE, and whenever the app
-- queries by that column.
--
-- Scope is exactly the 6 FKs flagged live (Advisor 0001 "Unindexed foreign
-- keys"), confirmed against pg_constraint/pg_index before writing this file:
--   payments.verified_by             -> profiles.id
--   return_requests.order_item_id    -> order_items.id
--   return_requests.seller_decided_by -> profiles.id
--   return_requests.admin_decided_by  -> profiles.id
--   stock_adjustments.created_by     -> profiles.id
--   wishlists.product_id             -> products.id (wishlists_unique_item
--     covers (user_id, product_id), which does not serve product_id-alone
--     lookups since product_id isn't the leading column)
--
-- Additive only: plain CREATE INDEX, no data read/written, no existing index,
-- constraint, grant, or RLS policy touched. Naming follows the repo
-- convention (<table>_<column>_idx), matching e.g. products_seller_id_idx.
--
-- ROLLBACK:
--   drop index if exists public.payments_verified_by_idx;
--   drop index if exists public.return_requests_order_item_id_idx;
--   drop index if exists public.return_requests_seller_decided_by_idx;
--   drop index if exists public.return_requests_admin_decided_by_idx;
--   drop index if exists public.stock_adjustments_created_by_idx;
--   drop index if exists public.wishlists_product_id_idx;
-- =============================================================================

begin;

create index if not exists payments_verified_by_idx
  on public.payments (verified_by);

create index if not exists return_requests_order_item_id_idx
  on public.return_requests (order_item_id);

create index if not exists return_requests_seller_decided_by_idx
  on public.return_requests (seller_decided_by);

create index if not exists return_requests_admin_decided_by_idx
  on public.return_requests (admin_decided_by);

create index if not exists stock_adjustments_created_by_idx
  on public.stock_adjustments (created_by);

create index if not exists wishlists_product_id_idx
  on public.wishlists (product_id);

commit;
