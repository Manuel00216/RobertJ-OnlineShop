-- =============================================================================
-- Revoke EXECUTE on trigger-only functions from public/anon/authenticated
-- (Security hardening — audit finding F-D1; Supabase advisor 0028/0029
-- "SECURITY DEFINER function executable by anon/authenticated").
--
-- These four functions exist ONLY as trigger bodies (see
-- 20260815000000_inventory_and_stock_history.sql). Because they live in the
-- `public` schema and default EXECUTE is granted to PUBLIC, PostgREST exposes
-- them at /rest/v1/rpc/<name>, so `anon` and `authenticated` can invoke them
-- directly. They read trigger context (NEW/OLD/TG_OP), so a direct RPC call
-- would mostly error or no-op — but it is needless, unauthenticated attack
-- surface and the advisor flags it.
--
-- SAFE / NON-BREAKING: PostgreSQL does NOT check EXECUTE privilege when a
-- trigger fires — the trigger mechanism runs the function as part of the
-- statement regardless of who can call it. Revoking EXECUTE therefore removes
-- the direct-RPC path only; the triggers
--   products_seed_inventory, products_sync_inventory_shop,
--   inventory_sync_products_quantity, orders_restock_on_cancel
-- continue to fire exactly as before. `postgres` and `service_role` retain
-- EXECUTE (owner + trusted server role), which is irrelevant to the browser.
--
-- Additive/idempotent: REVOKE is a no-op if the grant is already absent.
-- No function body, trigger, RLS policy, grant on any table, or data is
-- touched.
--
-- ROLLBACK:
--   grant execute on function public.restock_on_order_cancel()                to public, anon, authenticated;
--   grant execute on function public.seed_inventory_for_product()             to public, anon, authenticated;
--   grant execute on function public.sync_inventory_shop_id()                 to public, anon, authenticated;
--   grant execute on function public.sync_products_quantity_from_inventory()  to public, anon, authenticated;
-- =============================================================================

begin;

revoke execute on function public.restock_on_order_cancel()               from public, anon, authenticated;
revoke execute on function public.seed_inventory_for_product()            from public, anon, authenticated;
revoke execute on function public.sync_inventory_shop_id()                from public, anon, authenticated;
revoke execute on function public.sync_products_quantity_from_inventory() from public, anon, authenticated;

commit;
