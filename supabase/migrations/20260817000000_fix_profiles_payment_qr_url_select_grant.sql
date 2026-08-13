-- =============================================================================
-- Bug fix: `payment_qr_url` was never granted SELECT to `authenticated`.
--
-- `20260807040000_profiles_payment_qr_url.sql` added the column and granted
-- only `UPDATE (payment_qr_url)` — SELECT was never granted. But
-- `ORDER_COLUMNS` (src/lib/supabase/queries.ts, used by every order query —
-- listBuyerOrders/getBuyerOrder/getBuyerOrderSummary/listDashboardOrders/
-- getDashboardOrder) embeds `seller:profiles(... payment_qr_url)`, so ANY
-- query using it fails outright with "permission denied for table profiles"
-- — column-privilege checks apply to every column referenced in a query's
-- text, regardless of whether the query returns rows. This is not a new
-- restriction relaxed here: a buyer NEEDS to read the seller's QR code to
-- know where to send a QR payment (`ReceiptUpload` renders exactly this
-- field) — that's the entire point of the column. The
-- `profiles_payment_qr_url_role` CHECK already keeps it null for buyer rows,
-- so this grant does not expose anything unintended.
--
-- ROLLBACK:
--   revoke select (payment_qr_url) on public.profiles from authenticated;
-- =============================================================================

begin;

grant select (payment_qr_url) on public.profiles to authenticated;

commit;
