-- =============================================================================
-- Payments Module (Phase 7), part 4: the seller's own receiving QR code. A
-- buyer choosing QR at checkout needs to know WHERE to send money — nothing
-- in this schema modeled that until now. Lives on `profiles` (the closest
-- thing to a "shop" this schema has today — see ARCHITECTURE.md TD-1, sellers
-- stand in for shops).
--
-- Design notes:
--  * `^https?://` CHECK matches the existing avatar_url/image_url pattern —
--    unlike `payments.receipt_path` (a private Storage path), this genuinely
--    is meant to be a renderable public-ish image URL the seller pastes in.
--  * A second CHECK restricts it to seller/admin rows — a buyer profile has
--    no reason to ever carry a receiving QR code, enforced at the DB level
--    (defense in depth) rather than only in the UI.
--  * `GRANT UPDATE (col)` is additive in Postgres — this does not need to
--    repeat the full existing column list from
--    20260804000000_restore_profiles_column_grants.sql.
--
-- ROLLBACK:
--   alter table public.profiles drop column payment_qr_url;
--   -- (drops its CHECK constraints and column grant automatically)
-- =============================================================================

begin;

alter table public.profiles
  add column payment_qr_url text,
  add constraint profiles_payment_qr_url_scheme
    check (payment_qr_url is null or payment_qr_url ~ '^https?://'),
  add constraint profiles_payment_qr_url_role
    check (payment_qr_url is null or role in ('seller', 'admin'));

grant update (payment_qr_url) on public.profiles to authenticated;

commit;
