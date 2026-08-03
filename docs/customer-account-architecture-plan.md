# Customer Account Module — Architecture & UI/UX Blueprint

> Status: **Planning only.** No implementation code in this document. This is
> the foundation for the next phase, mirroring the process used for
> `docs/auth-module-architecture-plan.md`. The **capstone proposal** is the
> single source of truth for scope.

## 0. Grounding — what this plan draws on

Every recommendation below is tied to a named source or to this codebase's own
prior decisions, not general intuition:

| Area | Grounded in |
| --- | --- |
| Scope | The approved capstone proposal ("Customer Account and Order Tracking" + the Order Tracking storyboard) |
| Order-tracking UX | Actual Amazon / Shopee / Lazada / Etsy order-tracking patterns |
| Form UX | Nielsen Norman Group form-design heuristics (via the auth plan) |
| Security | OWASP ASVS v5; Supabase RLS + trigger-enforced invariants already in the schema |
| Accessibility | WCAG 2.2 AA; WAI-ARIA Authoring Practices |
| Architecture | This project's `docs/architecture.md` feature-first convention and the centralized `lib/supabase/queries.ts` layer |

---

## 1. Existing project review (Task 1)

### 1.1 What's already built (do not rebuild)

| Layer | File | State |
| --- | --- | --- |
| Session helpers | `lib/supabase/queries.ts` | `getSessionUser`, `requireSessionUser`, `requireRole` — **implemented** |
| Auth actions | `features/auth/actions/auth.actions.ts` | Sign in/up/out, forgot/reset, resend — **implemented**, return `ActionResult<T>` |
| Route protection | `proxy.ts` + `constants/routes.ts` | `PROTECTED_ROUTE_PREFIXES`, `AUTH_ROUTES`, redirect-with-`redirectTo` — **implemented** |
| Route constants | `constants/routes.ts` | `orders`, `orderDetail(id)`, `profile` prefix, `notifications`, `dashboard` — **defined** (see §2 for additions) |
| Cart state | `features/cart` | Public guest cart (localStorage `useReducer`), `CartItem.sellerId` for future per-seller checkout — **implemented** |
| Order tables | `supabase/migrations/…initial_schema.sql` | `orders`, `order_items` with RLS + `create_order()` RPC — **exist** |
| Profile read | `public.get_my_profile()` RPC | Returns the caller's full `profiles` row including `phone` (no direct SELECT grant) — **exists** |
| Async contract | `components/feedback/{Empty,Error,Loading}State` | Every async surface renders loading/error/empty/success — **exists** |
| Order cache keys | `constants/query-keys.ts`, `lib/cache/tags.ts` | `QUERY_KEYS.orders`, `CACHE_TAGS.orders(userId)` — **staged, currently unused** |
| Feature scaffolds | `features/{orders,dashboard,…}/` | Empty barrels (`export {}`) — ready to be filled |

**What remains for this module is UI + buyer-scoped order queries** — the auth
layer, RLS, and order tables exist and are tested. This changes the roadmap
shape (§12): front-loaded toward data-access functions + UI, no schema work.

### 1.2 Design system to inherit (customer-facing = seamless Landing extension)

The capstone owner's standing directive: **all customer-facing modules (Customer
Account, Shopping Cart, Checkout, Order Tracking) are a seamless extension of
the approved Landing Page design system** — the same branding, typography,
colors, spacing, buttons, cards, and visual language already established by the
Landing, Authentication, and Product Catalog modules.

| Token / pattern | Value | Source |
| --- | --- | --- |
| Display font | `font-serif` → DM Serif Display, weight 400 | `app/layout.tsx` |
| Body font | `font-sans` → DM Sans (variable) | `app/layout.tsx` |
| Ink | `rj-black #0D0D0D` | `globals.css` |
| Paper | `rj-white #F8F7F5` | `globals.css` |
| Accent | `rj-red #E8192C`, hover `rj-red-dark #C8111E` | `globals.css` |
| Grays | `rj-gray-{50,100,200,400,600,800}` | `globals.css` |
| Buttons | pill `rounded-full`, bold, `active:scale-95` — `Button` `rj` / `rjOutline` variants | `components/ui/button.tsx` |
| Cards | `rounded-xl`/`rounded-2xl`/`rounded-3xl`, `shadow-sm` → `shadow-xl` on hover | `FeaturedShops.tsx`, catalog cards |
| Section labels | `text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red` (small red uses `rj-red-dark` for AA) | every landing section, `CatalogHeader` |
| Inputs | pill `rounded-full border-[1.5px]` search; `FormField` `tone="brand"` forms | `ProductSearchInput`, auth fields |
| Wordmark | `components/brand/Wordmark.tsx` (`onDark` prop) — shared by `(marketing)`, `(auth)`, and future dashboards | auth UI/UX spec v1.0 |
| Icons | `lucide-react` | throughout |

**The future Administrator/staff dashboards are a separate management-focused
design** (denser data tables, tighter chrome) that stays consistent with the
overall branding (same `Wordmark`, `rj-red` accents, DM Sans). They are **out of
scope for this module**; this note exists so the customer account never borrows
admin styling.

### 1.3 Component reuse vs. new build

| Existing | Reuse as-is? | Notes |
| --- | --- | --- |
| `Button` (`rj`/`rjOutline`, `rj`/`rjSm`) | ✅ | All account CTAs |
| `Badge` (tones) | ✅ | Status/payment badges, colored + text-labelled (never color-only) |
| `FormField` (`tone="brand"`, icon/trailing/labelAction) | ✅ | Profile form fields |
| `EmptyState` / `ErrorState` / `LoadingState` | ✅ | Order list empty/error; loading |
| `PaginationControls` (products) | ✅ | Order-history pagination |
| `getInitials` / `formatCurrency` / `formatDate` | ✅ | Avatar initials, order totals, dates |
| `CatalogHeader` (rj eyebrow + serif title) | ✅ | Account page headers |
| `ProductSearchInput` pill pattern | ✅ | Order-number search |
| `MainNav` / `SiteHeader` | Partially | Add `AccountMenu` popover when signed in (§5) |
| `LandingNavbar` | Partially | Make user-aware via a server-passed prop (§5) |

**New components live in `features/account/` (account UI) and
`features/orders/` (order domain), detailed in §5–6.**

---

## 2. Information architecture (Task 2)

```
/account            Account overview (hub): identity, order-status summary, recent orders
/orders             Order history: list + search by Order ID + status filter + pagination
/orders/[id]        Order detail + status timeline + cancel (if cancellable)
/profile            Profile & account settings (editable fields; email read-only)
```

**Route decisions:**
- **`/account`** = new hub. Add `ROUTES.account = "/account"` and the
  `/account` prefix to `PROTECTED_ROUTE_PREFIXES`.
- **`/orders`**, **`/orders/[id]`** reuse existing `ROUTES.orders` /
  `ROUTES.orderDetail` (MainNav already links "Orders" → `/orders`).
- **`/profile`** is the protected-but-unbuilt reserved route from the auth
  plan §8; add `ROUTES.profile = "/profile"`.
- **`/dashboard`, `/dashboard/inventory`, `/dashboard/reports` stay reserved
  for the Administrator module** (seller/admin, `DASHBOARD_ROLES`) — the
  customer account must not collide with them.
- **`/cart`** stays public (guest cart); **`/checkout`** is a future module.

**Why `/account` and not `/dashboard`:** `ROUTES.dashboard` and its
`/dashboard/inventory` + `/dashboard/reports` sub-routes are already committed
to the Administrator module (auth plan §8, `DASHBOARD_ROLES`). The customer
account gets its own namespace to avoid conflating a buyer's order tracking with
the management console the proposal lists as a separate deliverable.

---

## 3. User journey flows (Task 3)

### 3.1 Primary flow

```
Guest browsing (landing or catalog)
   │  click "Sign In" (or hit a protected account route → middleware)
   ▼
proxy.ts guards /account | /orders | /profile
   → signed out → /sign-in?redirectTo=<path>   (already implemented)
   → signed in  → pass through
   ▼
(account)/layout → requireSessionUser() (server, belt-and-suspenders)
   ▼
/account  Overview: identity + status-count cards + 5 recent orders
   ├──▶ /orders   Order history: search by Order ID + status filter + pagination
   │       └──▶ /orders/[id]  Order detail + timeline + cancel (if cancellable)
   └──▶ /profile  Edit name/username/phone/bio/avatar; email read-only;
                  link to forgot-password for password changes
```

Entry points: **AccountMenu** in `SiteHeader` (shop chrome) and a **"My
Account" link** in `LandingNavbar` (marketing chrome, now user-aware).

### 3.2 Cancel order flow

```
/orders/[id] → "Cancel order" (only when order_status ∈ {pending, confirmed})
   → confirm (inline AlertDialog-style block, focus-managed)
   → cancelOrderAction(orderId) → requireSessionUser → verify ownership + state
   → service.cancelBuyerOrder → orders.update to 'cancelled' (RLS + trigger allow)
   → revalidate CACHE_TAGS.orders(userId) + paths
   → timeline updates to Cancelled (terminal); button disappears
```

### 3.3 Profile update flow

```
/profile → ProfileForm (useActionState)
   → updateProfileAction(prevState, formData) → updateProfileSchema (Zod)
   → requireSessionUser → service.updateMyProfile (own-row UPDATE, granted cols)
   → revalidatePath("/profile", "layout")
   → ActionResult { success:true } → inline success state (no navigation)
```

### 3.4 Unauthorized / missing-order flow

```
/orders/[id] with an id that isn't the signed-in buyer's order
   → getBuyerOrder returns null → local not-found.tsx (rj style), HTTP 200
   (framework streaming behavior; root not-found 404s — same as catalog)
```

---

## 4. Account screens (Task 4)

Every screen renders inside the shared `(account)` shell (§5) with an rj
editorial header (`CatalogHeader` pattern). Each documents Loading / Error /
Empty / Success per the existing async contract.

### 4.1 Overview — `/account`

| Element | Detail |
| --- | --- |
| Header | "My Account" eyebrow + serif title |
| Identity | Avatar initials, name, email |
| Status summary | Count cards for Pending / To Pack / Ready for Pickup / Shipped / Delivered / Cancelled (links to `/orders?status=…`) |
| Recent orders | Top 5 `OrderCard`s + "View all orders" |
| Quick links | Orders, Profile |

### 4.2 Order history — `/orders`

| Element | Detail |
| --- | --- |
| Header | "Orders" eyebrow + serif title |
| Search | **Order-ID search** (per the proposal storyboard) — pill input, `ilike order_number` |
| Filter | Status chips (rj chip pattern, `aria-pressed`), updates URL params, clears `page` |
| List | Mobile-first `OrderCard` list (thumbnails, order number, date, total, status badge) |
| Pagination | Reuse `PaginationControls` |
| **Empty** | `EmptyState` "No orders found" (search no-match) |
| **Loading** | `OrderSkeletons` under `Suspense` |

### 4.3 Order detail — `/orders/[id]`

| Element | Detail |
| --- | --- |
| Header | Order number, placed date, status badge |
| Timeline | Progress stepper — Pending → To Pack → Ready for Pickup → Shipped → Delivered (or Cancelled/Refunded terminal) with `aria-current="step"` |
| Items | `OrderItemsList` — thumbnails, qty, unit price, subtotal |
| Totals | Subtotal / shipping / total (`formatCurrency`) |
| Delivery | `shipping_address` JSON snapshot rendered as a card (read-only) |
| Payment | `payment_status` badge (read-only; COD / receipt verification are checkout + admin-module concerns) |
| Shop source | Seller name from `profiles` (per order) |
| Cancel | `CancelOrderButton` only when `pending`/`confirmed`; confirm; updates timeline |
| **Not found** | Local `not-found.tsx` (rj style) for a non-owned / non-existent order |

### 4.4 Profile — `/profile`

| Field | Maps to |
| --- | --- |
| Full name | `profiles.full_name` |
| Username | `profiles.username` (unique-lower constraint; regex `^[a-z0-9_]{3,30}$`) |
| Phone | `profiles.phone` (read via `get_my_profile()` RPC — no direct SELECT grant) |
| Avatar URL | `profiles.avatar_url` (https text field; **no upload** — no storage bucket in scope) |
| Bio | `profiles.bio` (≤500) |
| Email (read-only) | `auth.users.email` via `SessionUser` |
| Change password | Link to the existing forgot-password flow (no new password UI) |

**Loading:** `Button.isLoading`, form disabled while pending.
**Error:** field-level via `FormField errors=`, form-level via `ErrorState`.
**Success:** inline success banner + `revalidatePath` so the sidebar identity
updates immediately.

---

## 5. Component architecture (Task 5)

```
(account)/layout ── AccountShell ── AccountSidebar (nav, identity, sign-out)
                                 └─ <main>
account/        ── OverviewSummary (cards) + RecentOrdersList + quick links
orders/         ── OrderSearchInput + OrderStatusFilter + (keyed Suspense)
                   OrderListSection ── count + OrderCard[] + PaginationControls
orders/[id]/    ── OrderHeader (number/date/badge) + OrderTimeline
                   + OrderItemsList + OrderSummary + ShippingAddressCard
                   + PaymentStatusBadge + CancelOrderButton (confirm)
profile/        ── ProfileForm (FormField tone="brand") + success/error states
```

| Component | Owns | Does NOT own |
| --- | --- | --- |
| `AccountShell` | Responsive sidebar+main grid; rj surfaces | Data fetching (pages fetch; shell gets `user`) |
| `AccountSidebar` | Nav links + `aria-current`, identity, sign-out | Route logic |
| `AccountMenu` (client) | SiteHeader user popover (links + sign-out), `aria-expanded`, Escape | Session state (server passes `user`) |
| `OrderCard` / `OrderStatusBadge` | Order list row + status tone mapping | Data fetching |
| `OrderTimeline` | Status stepper (`aria-current="step"`) | Status semantics (constants own the map) |
| `OrderItemsList` / `OrderSummary` | Items + totals rendering | Money math (formatted via `formatCurrency`) |
| `OrderSearchInput` / `OrderStatusFilter` | URL-param updates (clear `page`) | Query execution |
| `CancelOrderButton` | Confirm + calls `cancelOrderAction` | State rules (constants/server action guard) |
| `ProfileForm` | `useActionState` wiring + success/error rendering | Network (that's the action layer) |

**Explicitly reused, not duplicated:** `Button` (`rj`/`rjOutline`),
`Badge` (tones), `FormField` (`tone="brand"`), `EmptyState`/`ErrorState`/
`LoadingState`, `PaginationControls`, `Wordmark`, `getInitials`,
`formatCurrency`, `formatDate`, `CatalogHeader` header pattern.

---

## 6. Folder structure (Task 6)

```
src/
├── app/
│   └── (account)/                     NEW route group — shared buyer-account shell
│       ├── layout.tsx                 requireSessionUser → AccountShell
│       ├── account/page.tsx           Overview (hub)
│       ├── orders/page.tsx            Order history (search + filter + list + pagination)
│       ├── orders/[id]/page.tsx       Order detail + timeline (+ loading.tsx, not-found.tsx)
│       └── profile/page.tsx           Profile & settings
│
└── features/
    ├── account/                       Customer Account UI + profile (NEW)
    │   ├── components/
    │   │   ├── AccountShell.tsx       grid: sidebar + main (server)
    │   │   ├── AccountSidebar.tsx     client nav + user identity + sign-out
    │   │   ├── AccountMenu.tsx        client popover used by SiteHeader
    │   │   ├── OverviewSummary.tsx    status-count cards
    │   │   ├── RecentOrdersList.tsx   top-5 recent orders
    │   │   ├── ProfileForm.tsx        client, useActionState
    │   │   └── AccountSkeletons.tsx
    │   ├── actions/account.actions.ts # updateProfileAction
    │   ├── schemas/account.schema.ts  # updateProfileSchema
    │   ├── services/account.service.ts# getMyProfile/updateMyProfile mapping, overview assembly
    │   ├── constants/account.constants.ts  # nav items, copy
    │   ├── types/account.types.ts
    │   └── index.ts
    │
    └── orders/                        Order domain — shared with future Admin order mgmt
        ├── components/
        │   ├── OrderCard.tsx          responsive order-list item
        │   ├── OrderStatusBadge.tsx   badge tone per status
        │   ├── OrderTimeline.tsx      progress stepper
        │   ├── OrderItemsList.tsx     item rows w/ thumbnails
        │   ├── OrderSummary.tsx       subtotal / shipping / total card
        │   ├── OrderSearchInput.tsx   order-number search (pill)
        │   ├── OrderStatusFilter.tsx  status chips
        │   └── OrderSkeletons.tsx
        ├── actions/order.actions.ts   # cancelOrderAction
        ├── schemas/order.schema.ts    # cancelOrderSchema
        ├── services/order.service.ts  # listBuyerOrders/getBuyerOrder/cancelBuyerOrder
        ├── constants/order.constants.ts   # STATUS_LABEL_MAP, STATUS_TONE_MAP, timeline
        ├── types/order.types.ts
        └── index.ts
```

Rules follow `docs/architecture.md`: pages never query the DB directly; services
own row→domain mapping (no snake_case past the boundary); actions validate with
Zod and return `ActionResult<T>`; every async surface renders
loading/error/empty/success; feature barrels via `index.ts`.

**Why two features:** `orders` is a shared domain (the future Administrator
"Order Management Dashboard" will reuse its types/constants/service); `account`
is the buyer-facing UI + profile. This mirrors how `products`/`categories`
were split in the Product Catalog module.

---

## 7. Database mapping (Task 7)

**No schema changes.** The proposal features that don't have a 1:1 column are
mapped here, not back-filled into the database.

| Proposal feature | Database | Interaction |
| --- | --- | --- |
| Order history / Order ID lookup | `orders` (RLS: buyer reads own) + `order_items` | `listBuyerOrders({buyerId, search?, status?, page})` — `ilike order_number`, enum status filter, `toRange` pagination |
| Order status timeline | `orders.order_status` enum | `getBuyerOrder(id, buyerId)` — order + items (+ product thumbnail/link if active) + seller name; `cache()`-wrapped |
| Status labels | enum values | **Mapped in constants — no schema change** (table below) |
| Delivery details | `orders.shipping_address` jsonb snapshot (set at checkout) | Read-only display card |
| Payment method / verification | `orders.payment_status` enum (COD / receipt verification are checkout + admin-module concerns) | Read-only badge |
| Shop source | `orders.seller_id` → `profiles` | Seller name shown per order |
| Cancel order | `orders` UPDATE (RLS: buyer) + `enforce_order_update_rules` trigger (buyer may set `cancelled`) | `cancelBuyerOrder` guarded server-side to `pending`/`confirmed` |
| Profile fields | `profiles` (own-row UPDATE; column grant on `full_name`/`username`/`avatar_url`/`phone`/`bio`; `get_my_profile()` RPC returns `phone`) | `getMyProfile()` + `updateMyProfile()` |
| Email | `auth.users` (no direct grant) | Read-only display from `SessionUser.email` |

**Status label mapping (customer-facing → DB enum):**

| Proposal label | DB `order_status` | Timeline step |
| --- | --- | --- |
| Pending | `pending` | 1 |
| To Pack | `confirmed` | 2 |
| Ready for Pickup | `processing` | 3 |
| Shipped | `shipped` | 4 |
| Delivered | `delivered` | 5 (terminal) |
| Cancelled | `cancelled` | terminal (from 1–2) |
| *(DB-only)* Refunded | `refunded` | terminal |

Payment status display: `pending`→"Payment pending", `paid`→"Paid",
`failed`→"Payment failed", `refunded`→"Refunded",
`partially_refunded`→"Partially refunded".

**API flow:**
- **Reads:** Page (RSC) → `cache()`-wrapped service (`lib/supabase/queries.ts` /
  `account.service`) → Supabase. `getBuyerOrderSummary(buyerId)` powers the
  overview.
- **Mutations:** Form/Button → Server Action (`useActionState`) →
  `requireSessionUser()` → service → Supabase → `revalidatePath` +
  `CACHE_TAGS.orders(userId)` → `ActionResult<T>`.
- New `queries.ts` additions are **additive**: `listBuyerOrders`,
  `getBuyerOrder`, `getBuyerOrderSummary`, `updateMyProfile`; `getMyProfile`
  wraps the existing `get_my_profile()` RPC. No existing function modified.

---

## 8. Route protection strategy (Task 8)

| Route class | Examples | Enforcement |
| --- | --- | --- |
| Public | `/`, `/products`, `/categories`, **`/cart`** | No check (guest cart decision from the auth plan) |
| Guest-only | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | `proxy.ts` `AUTH_ROUTES` |
| **Protected (any role)** | **`/account` (new), `/orders`, `/orders/[id]`, `/profile`** | `proxy.ts` `PROTECTED_ROUTE_PREFIXES` (+ `/account` added) → `/sign-in?redirectTo=…` |
| Seller/Admin-only | `/dashboard`, `/dashboard/inventory`, `/dashboard/reports` | `requireRole(DASHBOARD_ROLES)` in pages/actions — future Administrator module |

- Add `"/account"` to `PROTECTED_ROUTE_PREFIXES`; `/orders`, `/profile` are
  already listed.
- `(account)/layout.tsx` re-checks `requireSessionUser()` server-side
  (architecture.md rule: middleware is a convenience, not the boundary).
- **No role gate on the customer account** — any authenticated user (buyer, or
  a seller buying as a customer) has one; `DASHBOARD_ROLES` is deliberately NOT
  applied here.

---

## 9. Security checklist (Task 9)

- [x] **Ownership enforced by RLS** — `orders` SELECT `buyer_id = auth.uid()`;
      `getBuyerOrder` returns null for other users' orders.
- [x] **Cancel constrained at the DB layer** — `enforce_order_update_rules`
      lets a buyer set `cancelled` only; financial fields immutable via trigger.
- [x] **Phone read via RPC, not direct SELECT** — `get_my_profile()` is
      SECURITY DEFINER and the only path to `phone`.
- [x] **Server-side session re-check** — `requireSessionUser()` in the layout
      and every action, never trusting the client.
- [x] **Actions validate with Zod** before any DB write (`updateProfileSchema`,
      `cancelOrderSchema`).
- [x] **Profile writes only to granted columns** — RLS column grant on
      `full_name`/`username`/`avatar_url`/`phone`/`bio`; role escalation blocked
      by `prevent_role_self_escalation`.
- [x] **No new columns / no storage bucket** — avatar stays an https URL string;
      no upload surface to harden.
- [x] **`ActionResult<T>` error envelope** — actions never leak stack traces;
      generic messages via the existing policy.
- [x] **Order-number search is `ilike`** on a bound query param — no SQL
      injection (Supabase query builder parameterizes).
- [ ] **Double-submit prevention** — `Button.isLoading` + `useActionState`
      `isPending` disables submit on every new form (implementation-time item).

---

## 10. Responsive design plan (Task 10)

| Breakpoint | Tailwind | Layout |
| --- | --- | --- |
| Mobile | `< 640px` | Sidebar collapses to a horizontal scroll nav under the header; order history uses cards (no table); timeline stays compact (dots + labels); touch targets ≥44px |
| Tablet | `640–1023px` | Sidebar becomes an icon rail or top nav; overview cards grid |
| Desktop | `≥ 1024px (lg)` | Sticky left sidebar (240px) + main (max-w-6xl); order detail splits items + sticky totals summary |
| Wide desktop | `≥ 1280px (xl)` | Same grid, more breathing room |

`AccountShell` is the single place this logic lives — every account page reuses
it unchanged.

---

## 11. Accessibility checklist (Task 11)

- [x] **Semantic HTML** — `<form>`, `<label htmlFor>` (via `FormField`),
      `<nav>` for the sidebar, real `<button type="submit">`.
- [x] **Keyboard navigation** — native focusables; `AccountMenu` popover is
      keyboard-operable (`aria-expanded`, Escape to close); cancel confirm
      focus-managed.
- [x] **Visible focus** — `focus-visible:ring-2 ring-rj-red/30` on all
      interactive controls (existing convention).
- [x] **ARIA states** — `aria-current` on active nav + `aria-current="step"` on
      the timeline; `aria-live="polite"` for status/cancel transitions; status
      badge paired with visually-hidden text (color is never the only signal).
- [x] **Error announcements** — `FormField` (`aria-invalid`/
      `aria-describedby`/`role="alert"`), `ErrorState` `role="alert"` — reused.
- [x] **WCAG contrast** — small red text uses `rj-red-dark` (AA); all reused
      token pairs were already AA-verified in the auth UI/UX spec v1.0.
- [x] **`prefers-reduced-motion`** respected (no new looping animations).

---

## 12. Implementation roadmap (Task 12)

| Phase | Scope | Why this order |
| --- | --- | --- |
| **0. Data layer** | `ROUTES.account`/`ROUTES.profile` + `/account` prefix; `order.types.ts` + `account.types.ts`; `STATUS_LABEL_MAP`/`STATUS_TONE_MAP`; `listBuyerOrders`/`getBuyerOrder`/`getBuyerOrderSummary`/`getMyProfile`/`updateMyProfile`/`cancelBuyerOrder` | Everything downstream depends on the types + queries + constants |
| **1. Account shell + navigation** | `(account)/layout` + `AccountShell`/`AccountSidebar`; `AccountMenu` in `SiteHeader`; `user` prop → `LandingNavbar` | Establishes the URLs + entry points early so routes are reachable |
| **2. Order history + detail + tracking** | `/orders` + `/orders/[id]` pages, `OrderCard`, `OrderTimeline`, cancel action + confirm | The proposal's core "Order Tracking" deliverable |
| **3. Overview hub** | `/account`: summary cards + recent orders | Depends on order queries from Phase 2 |
| **4. Profile management** | `/profile` form + action + success/error states | Independent; lowest-risk screen, builds last |
| **5. Polish + verify** | Skeletons/empty/error states, responsive + a11y pass; `npm run lint` / `typecheck` / `build`; E2E against live Supabase with a temp buyer + orders via `create_order`, then **full cleanup** (0 rows verified) | Standard: verify integration after all pieces exist |

---

## 13. Explicit scope boundaries & self-audit

**In scope (this document plans, next phase builds):** `/account` overview,
`/orders` order history with Order-ID search + status filter + pagination,
`/orders/[id]` order detail with status timeline + cancel, `/profile` profile
editing (name/username/phone/bio/avatar), account entry points (SiteHeader
`AccountMenu`, `LandingNavbar` "My Account").

**Explicitly OUT (per the capstone proposal + standing project rules):**
notifications center, wishlist, reviews/ratings, loyalty points, live chat,
affiliate systems, address book / saved addresses, saved payment methods, order
reorder, returns/refunds UI, contact-seller, real-time courier/GPS tracking,
generative-AI assistant. No schema changes; proposal features without a direct
DB match are documented as mappings (§7), not back-filled.

**Self-audit:**
- Every planned screen maps to the proposal ("Customer Account and Order
  Tracking" + Order Tracking storyboard) — no feature lacks a proposal anchor.
- **Design-system directive honored:** every customer-facing page reuses the
  Landing/Auth/Catalog visual language (rj tokens, Wordmark, editorial headers,
  `rj` pill buttons, `FormField` `tone="brand"`) — the account is a seamless
  extension, not an admin surface; the future admin dashboard is flagged as a
  separate management design.
- Consistent with `docs/architecture.md` (feature-first, service-owned mapping,
  RLS as final boundary), `docs/auth-module-architecture-plan.md` (route
  protection table, `ActionResult<T>`, deferred Profile module now being built),
  and the auth UI/UX spec v1.0 (tokens, Wordmark, focus policy).
- Verification: lint/typecheck/build clean; E2E temp-data pass with cleanup;
  WCAG AA spot-check.
