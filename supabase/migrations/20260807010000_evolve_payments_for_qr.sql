-- =============================================================================
-- Payments Module (Phase 7): evolve `payments` from the retired Stripe spike's
-- shape toward the SAD's actual target — COD + QR receipt upload with manual
-- verification (ADR-008). Companion migrations follow: verification RPCs +
-- trigger fix (qr_payment_rpcs), Storage bucket/policies (payment_receipts_storage),
-- seller payment QR code (profiles_payment_qr_url).
--
-- Design notes:
--  * `provider`, `provider_transaction_id`, `stripe_event_id`, `charge_id`,
--    `customer_id`, `customer_email` were Stripe-only fields. The Stripe spike's
--    application code was already removed (ADR-014) — dropping these resolves
--    TD-3 (ARCHITECTURE.md Technical Debt Register) instead of leaving dead
--    columns behind. `failure_reason` is kept — it's generic enough to reuse
--    for a rejected-receipt reason.
--  * `receipt_url` is renamed to `receipt_path` and gets NO `^https?://` CHECK
--    (unlike `avatar_url`/`image_url`/`product_images.url`): the new Storage
--    bucket (see the storage migration) is PRIVATE, so this column holds an
--    opaque Storage object path, not a publicly renderable URL — a real URL is
--    only ever a short-lived signed link generated on read, never stored.
--  * `verified_by`/`verified_at` are the audit trail for manual verification —
--    who (seller or admin) made the call, and when.
--  * No RLS/grant changes here: the existing participant-or-admin SELECT policy
--    and the "only privileged writers" grant posture (no INSERT/UPDATE grant to
--    anon/authenticated) are already correct for the new shape — writes will go
--    through the SECURITY DEFINER RPCs added in the next migration, not new
--    RLS policies.
--
-- ROLLBACK (not straightforward — dropped columns lose data; only safe before
-- any real QR payments exist):
--   alter table public.payments rename column receipt_path to receipt_url;
--   alter table public.payments drop column verified_by, drop column verified_at;
--   alter table public.payments
--     add column provider text not null default 'stripe',
--     add column provider_transaction_id text,
--     add column stripe_event_id text,
--     add column charge_id text,
--     add column customer_id text,
--     add column customer_email text;
--   -- 'qr_upload' cannot be cheaply removed from payment_method_type once added.
-- =============================================================================

begin;

-- Must run before it's referenced by anything later in this migration chain;
-- PG12+ allows ADD VALUE inside a transaction as long as the new value isn't
-- used in the same transaction (it isn't, here).
alter type public.payment_method_type add value 'qr_upload';

alter table public.payments
  drop column provider,
  drop column provider_transaction_id,
  drop column stripe_event_id,
  drop column charge_id,
  drop column customer_id,
  drop column customer_email;

alter table public.payments
  rename column receipt_url to receipt_path;

alter table public.payments
  add column verified_by uuid references public.profiles (id),
  add column verified_at timestamptz;

comment on column public.payments.receipt_path is
  'Supabase Storage object path in the private payment-receipts bucket, NOT a public URL. Resolve to a signed URL on read.';

commit;
