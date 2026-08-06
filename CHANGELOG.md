# Changelog

All notable changes to RoberJ Online Shop are documented here, newest first. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

> [!NOTE]
> The project has not reached a versioned `1.0` release, so entries are grouped by date rather than semantic version. Historical entries below are reconstructed from migration timestamps and existing planning docs — they mark when work **landed**, not when this changelog was created. Going forward, every PR that ships a module milestone, a schema change, or a business-facing behavior change should add an entry here in the same PR (see [CONTRIBUTING.md → Documentation update requirements](./CONTRIBUTING.md#documentation-update-requirements)).

## [Unreleased]

### Added
- Enterprise documentation suite: `DECISIONS.md`, `MODULES.md`, `CONTRIBUTING.md`, `SECURITY.md`, this `CHANGELOG.md`.
- Cross-linking and governance sections added across `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`.
- `isStripeConfigured` export (`src/config/env.ts`) — client-safe check for whether the Stripe spike is available.

### Fixed
- `src/config/env.ts`: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are now optional. The app boots on Supabase credentials alone, matching what the docs already claimed (see `DECISIONS.md` → ADR-014, `ARCHITECTURE.md` → TD-3, both now resolved on this point).
- `src/lib/stripe.ts`: `getStripe()` now throws a clear, actionable error when `STRIPE_SECRET_KEY` is missing instead of passing `undefined` into the Stripe SDK.
- `src/features/checkout/components/PaymentMethodCard.tsx`: the "Card" payment option is hidden automatically when Stripe isn't configured, so Checkout never offers a method guaranteed to fail.
- `src/features/checkout/components/StripePaymentFlow.tsx`: guards against an unconfigured Stripe key (defensive fallback; `PaymentMethodCard` already prevents reaching this state in normal use).

### Changed
- Deduplicated the Target-vs-Current mapping across docs: `README.md → Implementation Status` is now the single canonical source; `ARCHITECTURE.md`, `MODULES.md`, and `DECISIONS.md` (ADR-014) reference it instead of restating it.

### Known gaps (tracked, not resolved)
- Target COD + QR receipt-upload payment path not yet implemented (`payments` module remains ⏳ Upcoming for its official scope).
- `shops` / `shop_users` / `recommendation_rules` / `reports` tables not yet implemented.
- No automated test runner (see `DECISIONS.md` → ADR-015).

Full current-vs-target status: [README.md → Implementation Status](./README.md#implementation-status-target-vs-current) · [ARCHITECTURE.md → Technical Debt Register](./ARCHITECTURE.md#technical-debt-register).

---

## 2026-08-06 — Documentation baseline

### Added
- `README.md` rewritten as the AI-optimized business front door (vision, scope, roles, roadmap, folder map).
- `ARCHITECTURE.md` — technical specification, target/current schema mapping, RBAC and flow diagrams.
- `CLAUDE.md` extended with AI/developer working agreement, standards, and non-negotiables (preserving the existing `@AGENTS.md` import).
- `.env.example` added, matching `src/config/env.ts`.

---

## 2026-08-04 — Payments spike & security hardening

### Added
- `payments` table + `payment_method_type` enum (migration `20260804000200_add_payments.sql`).
- Stripe integration (`stripe.actions.ts`, `lib/stripe.ts`, `scripts/e2e-stripe.mjs`) — **provisional spike**, not the SAD's official payment path (see `DECISIONS.md` → ADR-014).
- `get_my_profile()` `SECURITY DEFINER` RPC (migration `20260804000100_add_get_my_profile.sql`).

### Fixed
- Restored correct column-level grants on `profiles` after a prior migration re-leaked `phone` via full-row SELECT (migration `20260804000000_restore_profiles_column_grants.sql`).
- Restricted `create_order` RPC execution to `authenticated` only, revoking anonymous execute (migration `20260804000300_revoke_create_order_anon_execute.sql`).

---

## 2026-08-03 — Landing page & storefront

### Added
- Landing page implementation completed per `landing-page-implementation-plan.md` — Hero, Featured Products, Featured Shops (placeholder), Marketplace Features, category browsing.
- `(marketing)` / `(shop)` route-group split.
- `features/landing` and `features/categories` service layers.

---

## 2026-08-02 — Foundation

### Added
- Initial database schema: `profiles`, `categories`, `products`, `product_images`, `orders`, `order_items` (migration `20260802000100_initial_schema.sql`), with full RLS from day one.
- `create_order` atomic checkout RPC, `handle_new_user` auto-provisioning trigger, order lifecycle triggers.
- Supabase client layer (`client.ts`, `server.ts`, `session.ts`) and centralized service layer (`queries.ts`).
- `src/proxy.ts` — Next.js 16 session refresh + route protection.
- Authentication module (sign up/in/out, password reset, email verification via PKCE).
- RLS audit remediation pass (migrations `20260802160000_security_hardening.sql`, `20260803000100_rls_hardening.sql`).

---

### Related documents

- 🧭 **[README.md](./README.md)** — current status and roadmap.
- 📐 **[ARCHITECTURE.md](./ARCHITECTURE.md)** — migration notes and technical debt register.
- 📜 **[DECISIONS.md](./DECISIONS.md)** — the reasoning behind what shipped.
