# DECISIONS.md — Architecture Decision Records

> [!IMPORTANT]
> **Read this first.** This is the permanent decision log for RoberJ Online Shop. Each record captures a choice that shaped the architecture: why it was made, what alternatives were rejected, and what would justify revisiting it. Decisions here **implement** the business spec in the **Software Architecture Document (SAD)** — they never override it.
>
> See also: [README.md](./README.md) (business context) · [ARCHITECTURE.md](./ARCHITECTURE.md) (resulting design) · [CLAUDE.md → Decision Priority](./CLAUDE.md#decision-priority) (how to weigh new choices).

## How to read this log

Every decision is a numbered ADR with a fixed shape: **Context → Problem → Options Considered → Decision → Consequences → Future Revisit**. Status is one of:

| Status | Meaning |
|--------|---------|
| ✅ **Accepted** | In force; assume it holds unless a newer ADR supersedes it. |
| 🔁 **Superseded** | Replaced by a later ADR (linked). Kept for history. |
| 🧪 **Provisional** | In force but explicitly flagged as a spike/experiment, not committed scope. |

**When to add a new ADR:** whenever a change matches [Definition of Breaking Change](./CLAUDE.md#definition-of-breaking-change), or reverses a principle in [ARCHITECTURE.md → System Design](./ARCHITECTURE.md#system-design). Append — never edit history out of an accepted record; supersede it instead.

## Index

| ID | Decision | Status |
|----|----------|--------|
| [ADR-001](#adr-001-marketplace-scoped-to-three-sibling-shops) | Marketplace scoped to three sibling shops | ✅ Accepted |
| [ADR-002](#adr-002-supabase-as-the-backend-platform) | Supabase as the backend platform | ✅ Accepted |
| [ADR-003](#adr-003-nextjs-app-router-as-the-frontend-framework) | Next.js App Router as the frontend framework | ✅ Accepted |
| [ADR-004](#adr-004-server-actions-instead-of-a-rest-api-layer) | Server Actions instead of a REST API layer | ✅ Accepted |
| [ADR-005](#adr-005-typescript-in-strict-mode-everywhere) | TypeScript in strict mode everywhere | ✅ Accepted |
| [ADR-006](#adr-006-centralized-service-layer-for-all-database-access) | Centralized service layer for all database access | ✅ Accepted |
| [ADR-007](#adr-007-row-level-security-as-the-primary-authorization-boundary) | Row-Level Security as the primary authorization boundary | ✅ Accepted |
| [ADR-008](#adr-008-manual-payment-verification-cod--qr-receipt-no-gateway) | Manual payment verification (COD + QR receipt), no gateway | ✅ Accepted |
| [ADR-009](#adr-009-rule-based-guided-product-selection-not-ai) | Rule-based Guided Product Selection, not AI | ✅ Accepted |
| [ADR-010](#adr-010-feature-first-repository-structure) | Feature-first repository structure | ✅ Accepted |
| [ADR-011](#adr-011-money-stored-as-integer-cents) | Money stored as integer cents | ✅ Accepted |
| [ADR-012](#adr-012-one-order-per-seller-cart-split-at-checkout) | One order per seller; cart split at checkout | ✅ Accepted |
| [ADR-013](#adr-013-guest-cart-is-client-side-only) | Guest cart is client-side only | ✅ Accepted |
| [ADR-014](#adr-014-stripe-integration-is-a-provisional-spike) | Stripe integration is a provisional spike | 🧪 Provisional |
| [ADR-015](#adr-015-no-automated-test-runner-yet) | No automated test runner yet | ✅ Accepted (deferred) |

---

## ADR-001: Marketplace scoped to three sibling shops

**Status:** ✅ Accepted

**Context:** Three family-run sibling shops each sell finished garments through separate, disconnected channels.

**Problem:** Customers cannot shop across the three businesses in one transaction; owners cannot see a unified view of sales or stock.

**Options Considered:**
1. Build three independent storefronts with shared code (a "shared component library, separate apps" approach).
2. Build an **open, general-purpose multi-vendor marketplace** any shop could join.
3. Build **one marketplace scoped exclusively to the three sibling shops**.

**Decision:** Option 3. The system is a closed, three-shop marketplace — not a general multi-vendor platform.

**Consequences:**
- Simpler onboarding/authorization model: shop membership is fixed and known, not self-service vendor signup.
- No vendor-approval workflow, marketplace fees, or multi-tenant billing needed.
- Explicitly ruled out of scope in the SAD and reiterated in [README.md → Out of Scope](./README.md#out-of-scope).

**Future Revisit:** If the business expands beyond the three shops, this decision must be revisited before onboarding a fourth seller — it affects RBAC, the (target) `shops`/`shop_users` model, and reporting.

---

## ADR-002: Supabase as the backend platform

**Status:** ✅ Accepted

**Context:** The system needs authentication, a relational database, row-level authorization, and file storage, built by a small team on a capstone timeline.

**Problem:** Hand-rolling auth, an API server, and storage would consume the majority of the project's time budget and its own attack surface.

**Options Considered:**
1. Custom Node/Express API + a managed Postgres instance + a separate auth provider (e.g. NextAuth) + S3-compatible storage.
2. **Supabase** (Auth + PostgreSQL + Storage + RLS) as a single, integrated backend.
3. A headless CMS / low-code backend (Firebase, Xano).

**Decision:** Option 2 — Supabase. It gives Postgres (not a proprietary document store), native Row-Level Security enforced at the database, first-class Next.js SSR support (`@supabase/ssr`), and Storage in one platform.

**Consequences:**
- Authorization can be enforced **in the database**, not only in application code (see [ARCHITECTURE.md → RBAC Model](./ARCHITECTURE.md#rbac-model)).
- The team writes SQL migrations and `SECURITY DEFINER` functions directly — real Postgres skills, not a vendor-specific query language.
- Vendor dependency on Supabase's managed platform; self-hosting Supabase is possible but not currently planned.

**Future Revisit:** If self-hosting or a different cloud vendor becomes a requirement, migration cost centers on Auth (user store) and Storage (file URLs), not the relational schema itself (plain Postgres).

---

## ADR-003: Next.js App Router as the frontend framework

**Status:** ✅ Accepted

**Context:** The team needs server-rendered pages, layouts shared across route groups, and a natural home for server-side data fetching.

**Problem:** A client-only SPA would push all data fetching and auth checks to the browser, hurting both performance and security (RLS alone is not a substitute for not shipping data the client shouldn't see).

**Options Considered:**
1. Client-rendered SPA (Vite + React Router) calling a separate API.
2. Next.js **Pages Router**.
3. Next.js **App Router** (Server Components, layouts, route groups, Server Actions).

**Decision:** Option 3 — Next.js 16 App Router.

**Consequences:**
- Route groups (`(marketing)`, `(auth)`, `(shop)`, `(account)`) give each area its own layout without affecting the URL.
- Server Components fetch data server-side by default, keeping secrets and heavy queries off the client.
- The project inherits Next.js 16's renamed conventions (e.g. `proxy.ts` instead of `middleware.ts`) — see [AGENTS.md](./AGENTS.md); contributors must not assume older Next.js knowledge applies unchecked.

**Future Revisit:** Re-evaluate only on a major Next.js version bump with breaking App Router changes; see [CLAUDE.md → Migration Policy](./CLAUDE.md#migration-policy) for the general upgrade discipline.

---

## ADR-004: Server Actions instead of a REST API layer

**Status:** ✅ Accepted

**Context:** The app needs mutations (place order, update profile, sign in) and some protected reads, callable from forms and client components.

**Problem:** Standing up and versioning a separate REST/GraphQL API layer duplicates validation and auth logic that Server Actions can colocate with the UI.

**Options Considered:**
1. A separate REST API (Next.js Route Handlers under `/api/*` or an external service).
2. GraphQL with a resolver layer.
3. **Server Actions** (`"use server"` functions) called directly from forms/components.

**Decision:** Option 3. Server Actions are RoberJ's API layer. Every action follows one shape: Zod validation → `requireSessionUser`/`requireRole` → delegate to the service layer → `revalidatePath` → return `ActionResult<T>`. See [ARCHITECTURE.md → API Conventions](./ARCHITECTURE.md#api-conventions).

**Consequences:**
- No separate API versioning or client-generated SDK to maintain.
- Actions are not directly callable by third parties — acceptable, since the SAD defines no external API consumers.
- The PKCE auth callback (`src/app/auth/callback/route.ts`) is the one necessary **Route Handler**, because OAuth/email-link redirects require a plain HTTP endpoint.

**Future Revisit:** If a future requirement needs a public/partner API (e.g. a mobile app or third-party integration), introduce versioned Route Handlers alongside Server Actions rather than replacing them.

---

## ADR-005: TypeScript in strict mode everywhere

**Status:** ✅ Accepted

**Context:** The system spans database rows, domain models, form input, and UI props — many opportunities for silent type mismatches (e.g. cents vs. dollars, snake_case vs. camelCase).

**Problem:** A dynamically typed codebase would push these mismatches to runtime, in a system that handles orders and money.

**Options Considered:**
1. JavaScript with JSDoc typing.
2. TypeScript in default/loose mode.
3. **TypeScript in `strict` mode**, with generated/hand-maintained Supabase types.

**Decision:** Option 3. `tsconfig.json` is strict; `database.types.ts` types every table; domain types in each feature keep camelCase models distinct from snake_case rows.

**Consequences:**
- Row→domain mapping (`toProduct`, `toOrder`, `toProfile` in `queries.ts`) is mandatory, not optional — it's where the type boundary is crossed deliberately.
- `npm run typecheck` (`tsc --noEmit`) is a required gate before any change is considered done (see [CLAUDE.md → Definition of Done](./CLAUDE.md#definition-of-done)).
- No `any` escapes or ignored errors are permitted (see [CLAUDE.md → AI Non-Negotiable Rules](./CLAUDE.md#ai-non-negotiable-rules)).

**Future Revisit:** N/A — this is a permanent standard, not a phase-specific choice.

---

## ADR-006: Centralized service layer for all database access

**Status:** ✅ Accepted

**Context:** Multiple features (products, orders, checkout, account) all need overlapping reads (e.g. "current user", "product by slug") and consistent error handling.

**Problem:** If every feature queries Supabase directly, query patterns, column selections, and error mapping drift and duplicate across the codebase.

**Options Considered:**
1. Each feature calls Supabase directly from its own `actions/` file.
2. A repository-per-table pattern with many small service files.
3. **One centralized service module**, `src/lib/supabase/queries.ts`, that owns every `.from()`/`.rpc()` call.

**Decision:** Option 3. `queries.ts` is the single data-access layer: literal column-select strings (for type inference), row→domain mappers, `cache()`-wrapped shared reads, and the auth helper functions.

**Consequences:**
- Easy to audit "everywhere the database is touched" — one file, one search.
- The file is large by design; it is deliberately organized into clearly commented sections (Products, Categories, Orders, Profile, Auth) rather than split prematurely.
- Features never import a Supabase client directly — enforced by convention and code review (see [CLAUDE.md → Folder Responsibilities](./CLAUDE.md#folder-responsibilities)).

**Future Revisit:** If `queries.ts` grows unmanageable, split by domain (e.g. `queries/products.ts`, `queries/orders.ts`) re-exported from a barrel — a mechanical refactor, not an architecture change. Track as debt first (see [ARCHITECTURE.md → Technical Debt Register](./ARCHITECTURE.md#technical-debt-register)) rather than doing it speculatively.

---

## ADR-007: Row-Level Security as the primary authorization boundary

**Status:** ✅ Accepted

**Context:** Four roles (Guest, Customer, Shop Owner, Administrator) need different read/write access to the same tables, and application-layer checks alone can be bypassed by a bug or a direct API call.

**Problem:** Relying solely on `requireRole()` checks in Server Actions means a single missed check anywhere leaks data or allows an unauthorized write.

**Options Considered:**
1. Application-layer checks only (guards in Server Actions).
2. Application-layer checks **plus** database-level **Row-Level Security (RLS)** policies as the backstop.
3. A separate authorization microservice.

**Decision:** Option 2 — defense in depth, with **RLS as the primary boundary** and everything else (route guards, layout checks, service-layer guards) as additional layers. See [ARCHITECTURE.md → RBAC Model](./ARCHITECTURE.md#rbac-model).

**Consequences:**
- Even a missed `requireRole()` call cannot leak data the database itself won't return.
- `SECURITY DEFINER` helper functions (`current_user_role()`, `is_admin()`) are required to avoid infinite recursion when RLS policies need to read `profiles.role`.
- Every new table **must** ship RLS policies in the same migration that creates it — never left open "temporarily."

**Future Revisit:** N/A — this is a permanent security principle. Any table without RLS is a defect, not a shortcut.

---

## ADR-008: Manual payment verification (COD + QR receipt), no gateway

**Status:** ✅ Accepted

**Context:** The SAD explicitly scopes payments to **Cash on Delivery** and **QR receipt upload**, verified manually — no payment gateway or courier API.

**Problem:** Payment gateways (Stripe, PayPal, etc.) add compliance surface, transaction fees, and integration complexity disproportionate to a three-shop capstone marketplace whose customers largely pay COD or via local bank/e-wallet QR transfer.

**Options Considered:**
1. Integrate a payment gateway (Stripe) for card payments.
2. **Manual verification**: buyer chooses COD, or uploads a QR-transfer receipt image; an admin/shop owner manually confirms payment.
3. No payment tracking at all (trust-based).

**Decision:** Option 2, per the SAD. This is the **official, committed payment path** for the capstone.

**Consequences:**
- No PCI compliance burden; no gateway fees; no external payment API dependency.
- Payment confirmation has a human-in-the-loop step and corresponding `pending → paid` transition, owned by staff, not automated.
- Receipt images need Supabase Storage with appropriate access policies (buyer can upload/view own; shop owner/admin can view; no public access).

**Future Revisit:** If transaction volume outgrows manual verification, revisit — but this is explicitly **out of scope** for the current capstone (see [README.md → Future Enhancements](./README.md#future-enhancements)). See also **ADR-014** for the current Stripe spike, which is not this decision.

---

## ADR-009: Rule-based Guided Product Selection, not AI

**Status:** ✅ Accepted

**Context:** Customers currently ask shop staff for manual recommendations, slowing the ordering process.

**Problem:** An AI/LLM-based recommendation engine would add nondeterminism, hosting cost, and a much larger testing/maintenance surface than a small capstone marketplace needs — and the SAD explicitly does not call for it.

**Options Considered:**
1. An AI/ML-based recommendation system (embeddings, LLM prompting).
2. **A rule-based engine**: explicit, human-authored conditions (category, price range, tags, stated preferences) mapped to product suggestions.
3. No guided selection; keep it fully manual.

**Decision:** Option 2, per the SAD. Guided Product Selection is **rule-based**, full stop.

**Consequences:**
- Rules are deterministic, explainable, and testable without a model-evaluation harness.
- The target schema includes a `recommendation_rules` table (see [ARCHITECTURE.md → Target Database Schema](./ARCHITECTURE.md#target-database-schema)); none exists yet — `features/assistant` is currently a stub, and the landing page's `SmartAssistantPreview` is a **visual preview only**, not a working engine.
- Any AI/LLM approach is explicitly **out of scope** and must not be introduced without a new ADR superseding this one.

**Future Revisit:** Only via explicit SAD amendment — this is a business-scope decision, not a technical preference.

---

## ADR-010: Feature-first repository structure

**Status:** ✅ Accepted

**Context:** The system has many business domains (auth, products, cart, checkout, orders, account, …) that each need their own components, actions, schemas, and types.

**Problem:** A purely technical layering (`components/`, `actions/`, `types/` each holding everything, regardless of domain) makes it hard to find or reason about "everything related to checkout."

**Options Considered:**
1. Technical layering: top-level `components/`, `hooks/`, `actions/` folders shared across all domains.
2. **Feature-first**: each domain owns a self-contained folder (`src/features/<name>/{actions,components,hooks,schemas,types,constants}`), with a thin shared layer (`src/components`, `src/lib`) for cross-cutting UI and utilities.
3. A monorepo with separate packages per domain.

**Decision:** Option 2. See the full anatomy in [README.md → Folder Structure](./README.md#folder-structure) and boundary rules in [ARCHITECTURE.md → Folder Architecture](./ARCHITECTURE.md#folder-architecture).

**Consequences:**
- New contributors (and AI assistants) can scope a task to one `features/<name>/` folder with high confidence.
- Reserved-but-unbuilt modules (`assistant`, `dashboard`, `inventory`, `notifications`, `reports`) are scaffolded consistently, signaling committed future shape rather than ad hoc placeholders.
- Requires discipline to avoid one feature reaching into another's internals — enforced by convention (see [CLAUDE.md → Module Boundaries](./CLAUDE.md#module-boundaries)), not by a build-time boundary tool.

**Future Revisit:** If cross-feature coupling becomes a recurring problem, consider adding an import-boundary lint rule (e.g. `eslint-plugin-boundaries`) — a tooling addition, not a structural change.

---

## ADR-011: Money stored as integer cents

**Status:** ✅ Accepted

**Context:** Orders, products, and payments all involve currency amounts that must never silently lose precision.

**Problem:** Floating-point currency math (`price: 19.99`) accumulates rounding errors and is a well-known source of financial bugs.

**Options Considered:**
1. Floating-point decimal columns (`numeric`/`float`).
2. **Integer minor units** (`price_cents`, `total_cents`), converted to display currency only at the UI edge.
3. A dedicated money/decimal library type throughout.

**Decision:** Option 2. Every monetary column is suffixed `_cents` and stored as an integer; `src/lib/utils/currency.ts` handles formatting for display.

**Consequences:**
- No floating-point rounding bugs in totals, subtotals, or refunds.
- Every new monetary field must follow the same convention — deviation is a code-review blocker.
- Multi-currency support (`currency` column, default PHP) is possible without changing the storage strategy.

**Future Revisit:** N/A — permanent convention.

---

## ADR-012: One order per seller; cart split at checkout

**Status:** ✅ Accepted

**Context:** A single cart can hold products from multiple shops (per [ADR-001](#adr-001-marketplace-scoped-to-three-sibling-shops) and the SAD's unified-cart requirement).

**Problem:** A single order row spanning multiple shops complicates fulfillment (each shop ships independently), payment reconciliation, and RLS (which shop's staff can see which line?).

**Options Considered:**
1. One order row containing line items from multiple shops.
2. **One order per seller**: checkout groups the cart by seller/shop and creates one order per group, each with its own status and payment record.
3. Separate carts per shop from the start (rejected — breaks the "one cart" requirement).

**Decision:** Option 2. `groupCartBySeller` (in `features/checkout/utils`) partitions the cart before order creation; the `create_order` RPC enforces **single-seller, single-currency** per call.

**Consequences:**
- Each shop owner sees and manages exactly their own orders — a natural fit for RLS.
- A customer's single checkout can produce multiple order records (one per shop involved) — this must be surfaced clearly in the UI (e.g. "3 orders placed"), not hidden.
- Order-level reporting/analytics must aggregate across the customer's related orders when a "purchase session" view is needed.

**Future Revisit:** If a "parent order" / "cart session" grouping entity is later needed for customer-facing UX, add it as a thin view over existing per-seller orders rather than merging them.

---

## ADR-013: Guest cart is client-side only

**Status:** ✅ Accepted

**Context:** Guests (SAD role) can browse and are expected to be able to build a cart before registering/logging in.

**Problem:** A server-persisted cart for anonymous users requires either session-tied anonymous accounts or device fingerprinting — both add complexity for a capability that's inherently ephemeral until checkout.

**Options Considered:**
1. Server-side cart tied to an anonymous session cookie.
2. **Client-side cart**: React `useReducer` + Context, persisted to `localStorage`, committed to the database only at checkout (which requires authentication).
3. No guest cart; require login before adding to cart.

**Decision:** Option 2. `/cart` is intentionally **excluded** from `PROTECTED_ROUTE_PREFIXES` — it's public by design.

**Consequences:**
- Zero server storage cost for abandoned carts.
- Cart contents are lost if the user clears browser storage or switches devices before checkout — an accepted tradeoff, not a bug.
- Checkout is the enforcement point: `PROTECTED_ROUTE_PREFIXES` includes `/checkout`, so committing a cart to an order always requires an authenticated Customer.

**Future Revisit:** If cross-device cart persistence becomes a requirement, add a server-synced cart **for authenticated users only**, without changing the guest experience.

---

## ADR-014: Stripe integration is a provisional spike

**Status:** 🧪 Provisional — not committed scope

**Context:** The SAD's official payment path is COD + QR receipt upload with manual verification ([ADR-008](#adr-008-manual-payment-verification-cod--qr-receipt-no-gateway)). The current codebase nonetheless contains a working Stripe integration (`stripe.actions.ts`, `payments` table with Stripe-specific columns, `scripts/e2e-stripe.mjs`).

**Problem:** Document this honestly: is Stripe the payment system, or an experiment that happened to get committed?

**Options Considered:**
1. Treat Stripe as the real, sanctioned payment path (would require amending the SAD).
2. **Treat Stripe as a provisional spike** — useful exploration, not official scope — and keep building the target COD/QR path.
3. Delete the Stripe code immediately.

**Decision:** Option 2. The Stripe code stays in the repo (it's real, working code and removing it destroys information), but is explicitly labeled **not the official capstone path** everywhere it's referenced. See [README.md → Implementation Status](./README.md#implementation-status-target-vs-current) and [ARCHITECTURE.md → Technical Debt Register (TD-3)](./ARCHITECTURE.md#technical-debt-register).

**Consequences:**
- ~~`src/config/env.ts` made Stripe keys required to boot~~ — **resolved**: Stripe keys are now optional (`env.ts`), `getStripe()` fails clearly instead of booting broken, and Checkout's Card option is hidden automatically via `isStripeConfigured` when unset. The app runs on Supabase credentials alone, matching this ADR's intent. Remaining TD-3 impact (see [ARCHITECTURE.md → Technical Debt Register](./ARCHITECTURE.md#technical-debt-register)) is scope-only, not a boot blocker.
- New payments work should build the **target** COD/QR flow, not extend the Stripe branch, unless a new ADR supersedes ADR-008.
- Do not present Stripe as done/shippable in demos or documentation without this caveat attached.

**Future Revisit:** Either (a) a new ADR formally adopts a payment gateway (requires SAD amendment / stakeholder sign-off), in which case this ADR is superseded, or (b) the Stripe code is retired once the COD/QR path ships, in which case this ADR is closed as "spike concluded, not adopted."

---

## ADR-015: No automated test runner yet

**Status:** ✅ Accepted (deferred, not rejected)

**Context:** The project has no Jest/Vitest/Playwright/RTL installed. The only automated verification is two Node scripts (`scripts/e2e-flow.mjs`, `scripts/e2e-stripe.mjs`) plus `lint`/`typecheck`.

**Problem:** Should the team invest in a test framework now, mid-capstone, or continue relying on manual verification plus typecheck/lint/build?

**Options Considered:**
1. Adopt a full test framework (Vitest + Testing Library + Playwright) immediately.
2. **Defer**: rely on strict TypeScript, ESLint, `tsc --noEmit`, and scripted E2E flows, and require every change to be manually exercised (see [CLAUDE.md → Testing Expectations](./CLAUDE.md#testing-expectations)); revisit once core modules stabilize.
3. Skip automated testing indefinitely.

**Decision:** Option 2. This is a **deliberate, temporary** choice, not an oversight — recorded here specifically so it isn't silently "fixed" by introducing a framework without discussion (which [CLAUDE.md → AI Non-Negotiable Rules](./CLAUDE.md#ai-non-negotiable-rules) already flags: no new libraries without clear value and approval).

**Consequences:**
- Regression risk is currently mitigated by strict typing + RLS (data-integrity bugs are often caught at the database layer) + manual flow verification, not by a regression suite.
- Tracked as technical debt (TD-6 in [ARCHITECTURE.md](./ARCHITECTURE.md#technical-debt-register)).

**Future Revisit:** Once Checkout (current phase) and Payments (target) stabilize, introduce Vitest for the service layer (`queries.ts` mappers, pure utils) and Playwright for the checkout/order critical path — the highest-value, lowest-effort starting point. Requires a new ADR before adding the dependency.
