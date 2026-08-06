-- =============================================================================
-- Module 6 (Stripe Checkout Integration): payments ledger.
--
-- Adds the `payments` table and the `payment_method_type` enum. One payments row
-- per order, keyed by Stripe identifiers for idempotency and reconciliation.
--
-- Design notes (per the approved plan + owner requirements):
--  * Module 6 only creates a Stripe Payment Intent; it does NOT write payments
--    rows or change orders.payment_status (stays 'pending'). Only the Module 7
--    webhook (service_role) writes payments and flips payment_status to a final
--    state.
--  * provider_transaction_id = Stripe payment_intent id (UNIQUE — idempotency).
--  * stripe_event_id        = Stripe webhook event id (UNIQUE — prevents
--    duplicate event processing).
--  * charge_id / customer_id / customer_email / receipt_url / failure_reason
--    are audit/reconciliation fields populated by the webhook.
--  * No inventory or fulfillment is finalized here — those follow webhook
--    confirmation in Module 7. (Order creation still reserves stock via the
--    pre-existing create_order() RPC, which applies to COD equally.)
--  * RLS: only the buyer/seller of the parent order (or an admin) may read;
--    no end-user INSERT/UPDATE/DELETE grants.
--
-- ROLLBACK:
--   drop policy "payments readable by order participants" on public.payments;
--   drop table public.payments;
--   drop type public.payment_method_type;
-- =============================================================================

begin;

create type public.payment_method_type as enum ('cod', 'card');

create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references public.orders (id) on delete restrict,
  provider                 text not null default 'stripe',
  provider_transaction_id  text not null unique,   -- Stripe payment_intent id
  stripe_event_id          text unique,            -- Stripe webhook event id (idempotency)
  charge_id                text,                   -- Stripe charge id (reconciliation)
  customer_id              text,                   -- Stripe customer id (reconciliation)
  customer_email           text,
  receipt_url              text,
  failure_reason           text,
  payment_method_type      public.payment_method_type not null default 'card',
  amount_cents             integer not null check (amount_cents > 0),
  currency                 char(3) not null default 'PHP',
  status                   public.payment_status not null default 'pending',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint payments_currency_format check (currency ~ '^[A-Z]{3}$')
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_provider_transaction_id_idx on public.payments (provider_transaction_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "payments readable by order participants"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.buyer_id = (select auth.uid())
             or o.seller_id = (select auth.uid())
             or public.is_admin())
    )
  );

-- Read to authenticated (RLS-scoped). No write grants to anon/authenticated:
-- only service_role (bypasses RLS, holds table privileges) writes payments.
-- The explicit REVOKE defeats Supabase's default privileges (which grant ALL on
-- new tables to anon and authenticated) — grant state must be least-privilege
-- regardless of how the migration is applied.
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

commit;
