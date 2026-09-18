-- =============================================================================
-- Xendit Online Payment (Module: Payments), part 1: new payment_method_type
-- value + payments columns needed to track a Xendit payment request/session
-- per attempt. Purely additive — no existing column/row is touched.
--
-- Design notes:
--  * 'xendit' is a new payment_method_type value alongside the existing
--    'cod'/'card'/'qr_upload' (Postgres enum values are permanent once added
--    — 'card' has been an unused leftover from the retired Stripe spike since
--    20260804101743_add_payments.sql; 'qr_upload' will become the same kind
--    of permanent-but-unused leftover once the QR flow is removed in a
--    follow-up migration).
--  * xendit_payment_request_id is set synchronously when we create the
--    payment request with Xendit; xendit_payment_id is set only once the
--    webhook confirms a terminal outcome — the true Xendit-side dedup key
--    per their webhook docs ("dedupe on payment_id").
--  * provider_response stores the last raw webhook payload for support/audit
--    (a full audit trail of every delivery lives in payment_webhook_events,
--    added in the next migration — this column is just "most recent").
--
-- ROLLBACK:
--   alter table public.payments
--     drop column xendit_payment_request_id,
--     drop column xendit_payment_id,
--     drop column payment_channel,
--     drop column checkout_url,
--     drop column expires_at,
--     drop column provider_response;
--   -- 'xendit' cannot be cheaply removed from payment_method_type (Postgres
--   -- enum values are permanent) — same accepted limitation as 'card'.
-- =============================================================================

begin;

alter type public.payment_method_type add value if not exists 'xendit';

alter table public.payments
  add column xendit_payment_request_id text,
  add column xendit_payment_id text,
  add column payment_channel text,
  add column checkout_url text,
  add column expires_at timestamptz,
  add column provider_response jsonb;

alter table public.payments
  add constraint payments_xendit_payment_request_id_key unique (xendit_payment_request_id);

alter table public.payments
  add constraint payments_xendit_payment_id_key unique (xendit_payment_id);

comment on column public.payments.xendit_payment_request_id is
  'Xendit''s payment_request_id, set synchronously when we create the request. Our correlation key for the buyer-initiated leg.';
comment on column public.payments.xendit_payment_id is
  'Xendit''s payment_id, set once the webhook confirms a terminal outcome. Xendit''s own documented dedupe key.';
comment on column public.payments.payment_channel is
  'GCASH / PAYMAYA / CARD — from Xendit''s channel_code, set once known.';
comment on column public.payments.checkout_url is
  'Redirect/session URL returned by Xendit, so an interrupted attempt can resume without creating a duplicate.';
comment on column public.payments.provider_response is
  'Most recent raw webhook payload for this payment, for support/debugging. Full delivery history lives in payment_webhook_events.';

commit;
