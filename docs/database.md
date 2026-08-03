# Database Architecture

Migration: [`supabase/migrations/20260802000100_initial_schema.sql`](../supabase/migrations/20260802000100_initial_schema.sql)

## 1. Overview

Six tables model the marketplace. Every table has RLS enabled, every foreign
key is indexed, and all money is stored as integer minor units.

| Table | Responsibility |
| --- | --- |
| `profiles` | Public user identity, 1:1 with `auth.users`. Owns `role`. |
| `categories` | Self-referencing taxonomy, admin-managed. |
| `products` | Listings owned by a seller. |
| `product_images` | Ordered images for a listing. |
| `orders` | Financial record. One buyer, one seller. |
| `order_items` | Immutable line items with price snapshots. |

Three ideas drive the design:

1. **Financial records are immutable.** Orders and order items snapshot price
   and title at purchase. Sellers editing listings never rewrite history.
2. **Authorization is derived, never duplicated.** `product_images` and
   `order_items` inherit their access rules from their parent row, so there is
   no second copy of a rule to drift.
3. **The database is the last line of defence.** Constraints and triggers
   enforce invariants that application code could bypass.

## 2. ERD

```
┌──────────────┐
│  auth.users  │  (Supabase-managed)
└──────┬───────┘
       │ 1:1  ON DELETE CASCADE
┌──────▼───────────────────────────┐
│ profiles                         │
│ id (PK, FK->auth.users)          │
│ role  buyer|seller|admin         │
│ full_name, username (uniq lower) │
│ avatar_url, phone, bio           │
└───┬──────────────────────┬───────┘
    │ 1:N                  │ 1:N (buyer_id / seller_id)
    │ seller_id            │      ON DELETE RESTRICT
    │ ON DELETE CASCADE    │
┌───▼──────────────────┐   │      ┌──────────────────────────┐
│ products             │   │      │ categories               │
│ id (PK)              │   │      │ id (PK)                  │
│ seller_id (FK)       │   │      │ parent_id (FK->self) ────┼──┐
│ category_id (FK) ────┼───┼─────►│ slug (uniq), name        │◄─┘
│ title, slug (uniq)   │   │      │ active, sort_order       │
│ price_cents, currency│   │      └──────────────────────────┘
│ quantity, condition  │   │
│ status, featured     │   │
│ location, tags[]     │   │
│ search_vector (gen)  │   │
└───┬──────────────┬───┘   │
    │ 1:N          │       │
    │ CASCADE      │       │
┌───▼────────────┐ │  ┌────▼─────────────────────────┐
│ product_images │ │  │ orders                       │
│ id (PK)        │ │  │ id (PK)                      │
│ product_id (FK)│ │  │ order_number (uniq, seq)     │
│ url, alt_text  │ │  │ buyer_id (FK), seller_id (FK)│
│ sort_order     │ │  │ subtotal/shipping/total_cents│
│ uniq(prod,sort)│ │  │ payment_status, order_status │
└────────────────┘ │  │ shipping_address (jsonb)     │
                   │  └────┬─────────────────────────┘
                   │       │ 1:N  ON DELETE CASCADE
                   │  ┌────▼─────────────────────────┐
                   │  │ order_items                  │
                   │  │ id (PK)                      │
                   └─►│ product_id (FK)  RESTRICT    │
                      │ order_id (FK)    CASCADE     │
                      │ product_title    (snapshot)  │
                      │ unit_price_cents (snapshot)  │
                      │ quantity, subtotal_cents     │
                      │ uniq(order_id, product_id)   │
                      └──────────────────────────────┘
```

## 3. Decisions that differ from the brief

### 3.1 `price` → `price_cents` (integer minor units)

The brief specified `price`. Money is stored as `integer` centavos instead.

Floating point cannot represent 0.1 exactly, so `numeric` or `integer` are the
only defensible choices. Integer minor units win over `numeric` because they
make rounding impossible by construction: there is no fractional value to
round. `19950` is unambiguous in a way `199.50` handling across JS, JSON, and
Postgres is not — JavaScript has no decimal type, so a `numeric` column
arrives in the client as a lossy float anyway.

Conversion happens once, at the service boundary (`toCents` / `formatCurrency`).

### 3.2 `orders.seller_id` — one order per seller

The brief listed `seller_id` on `orders`, which implies single-seller orders.
That is kept, and the consequence is made explicit: **a cart spanning several
sellers becomes several orders at checkout.**

This is how Amazon, Etsy, and Shopee all behave, and it is not a limitation —
it is the only coherent model. A single order cannot have one shipping status,
one payment capture, or one refund when three independent sellers fulfil it.

It also makes the required RLS rule cheap. "Sellers see orders containing their
products" becomes `seller_id = auth.uid()` — one indexed equality check —
instead of a correlated `EXISTS` against `order_items` evaluated per row.

`CartItem.sellerId` exists to support the grouping.

### 3.3 `images` → a `product_images` table

The brief listed `images` as a product column. It is a table instead.

An array column cannot carry `alt_text` (an accessibility requirement, not a
nice-to-have), cannot express ordering independently of storage, and cannot be
constrained per element. `unique (product_id, sort_order)` makes a duplicated
cover image unrepresentable.

### 3.4 `profiles.role` added

Not in the brief, but required: "categories — admin-only write" is
unimplementable without a role, and the existing auth service already reads it.

Users cannot escalate their own role — a `WITH CHECK` clause cannot compare
against the row's previous value, so it is enforced by the
`prevent_role_self_escalation` trigger.

### 3.5 `email` deliberately not copied into `profiles`

`auth.users.email` is the source of truth. Duplicating it creates a second copy
that silently drifts the first time a user changes their email.

### 3.6 Separate `payment_status` and `order_status`

The brief asked for both, which is correct and worth stating why: payment and
fulfilment fail independently. An order can be paid but not shipped, or shipped
and then refunded. Collapsing them into one enum makes those states
unrepresentable.

### 3.7 `create_order()` RPC added

Not requested. Without it, checkout is unsafe: two buyers read `quantity = 1`,
both pass the application-level check, and both orders succeed. `SELECT … FOR
UPDATE` inside a single transaction is the only correct fix, and it cannot be
expressed from the client.

## 4. Security model

| Table | anon | authenticated |
| --- | --- | --- |
| `profiles` | read all | read all; write own row only |
| `categories` | read active | read active; admin writes |
| `products` | read `active` | read `active` + own; write own |
| `product_images` | read if parent visible | write if parent owned |
| `orders` | none | read/write own as buyer or seller |
| `order_items` | none | read via parent order; insert into own order |

Reinforcing rules:

- **No `DELETE` policy on `orders` or `order_items`.** Absence of a policy is a
  denial. Financial records are cancelled, never destroyed.
- **`order_items` has no `UPDATE` policy.** Line items are write-once.
- **Order financials are immutable after insert**, enforced by
  `enforce_order_update_rules`.
- **`payment_status` is never client-writable.** Only a caller with no end-user
  JWT (the payment webhook running as `service_role`) may set it.
- **All `SECURITY DEFINER` functions pin `search_path = ''`** and fully qualify
  every identifier. Without this a caller can prepend a malicious schema and
  hijack the elevated function.
- **`current_user_role()` is `SECURITY DEFINER` by necessity.** A policy on
  `profiles` that itself selects `profiles` recurses infinitely; a definer
  function breaks the cycle.

### RLS performance

Every policy uses `(select auth.uid())` rather than bare `auth.uid()`. The
subquery form is evaluated once per statement; the bare call is re-evaluated
per row. On a 1,000-row page that is a 1,000× difference in function calls.

Policies are also scoped `to anon` / `to authenticated` so Postgres can skip
policies that cannot apply to the caller.

## 5. Indexes

Postgres does **not** index foreign keys automatically. Every FK here is
indexed; an unindexed FK turns parent deletes and joins into sequential scans.

Beyond the FKs:

| Index | Serves |
| --- | --- |
| `products_active_recent_idx` (partial) | Storefront listing. Partial, so drafts and archived rows are not in the index at all. |
| `products_active_category_created_idx` | Category browse. |
| `products_active_price_idx` | Price sort within active listings. |
| `products_seller_status_created_idx` | Seller inventory screen. |
| `products_title_trgm_idx` (GIN) | `ilike '%term%'`. A btree cannot serve a leading wildcard; this is the single most important index for the current search implementation. |
| `products_search_vector_idx` (GIN) | Full-text search, once the service adopts it. |
| `products_tags_idx` (GIN) | Tag filtering. |
| `orders_buyer_id_created_idx` / `orders_seller_id_created_idx` | Order history for each side, already ordered. |

## 6. Validation checklist

Reviewed as a code review, not assumed correct. Three defects were found and
fixed before finalising:

| # | Defect | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `slugify()` called `unaccent_fallback()` declared 17 lines later. `check_function_bodies` is on by default, so the migration aborts at `CREATE`. | **Blocker** | Reordered declarations. |
| 2 | `create_order()` was `SECURITY INVOKER`, so the buyer's stock decrement hit the products UPDATE policy (`seller_id = auth.uid()`) and failed. Checkout could never succeed. | **Blocker** | `SECURITY DEFINER` with `buyer_id` taken from `auth.uid()`, never a parameter. |
| 3 | `enforce_order_update_rules` blocked all `payment_status` changes. `service_role` bypasses RLS but **not triggers**, so the payment webhook was locked out permanently. | **Blocker** | Early return when `auth.uid()` is null (no end-user JWT = trusted server context). |

Remaining checks:

- [x] Every FK indexed
- [x] Every table has RLS enabled *and* explicit grants (either alone is wrong)
- [x] No policy can expose another user's order or order items
- [x] All `SECURITY DEFINER` functions pin `search_path = ''`
- [x] No RLS recursion (`profiles` policy does not select `profiles` unguarded)
- [x] Money columns are integer, non-negative, and totals are check-constrained
      (`total_cents = subtotal_cents + shipping_fee_cents`)
- [x] Order numbers use a sequence — `max()+1` would race under concurrency
- [x] `handle_new_user` cannot break signup (exception handler; a missing
      profile is recoverable, a broken signup is not)
- [x] Generated `search_vector` uses the two-argument `to_tsvector`, the only
      form that is `IMMUTABLE` and therefore legal in a generated column
- [x] Migration is one transaction and is re-runnable
- [x] Balanced `$$` quoting, no forward references (verified mechanically)

**Not verified:** the migration has not been executed. No local Postgres or
Docker was available in this environment. It is statically reviewed only —
run it against a branch or staging project before production.

### Known operational consequence

`orders.buyer_id` is `ON DELETE RESTRICT` against `profiles`, and `profiles.id`
is `ON DELETE CASCADE` from `auth.users`. A user who has ever placed an order
therefore **cannot be hard-deleted** — the cascade is refused.

This is intentional: destroying a buyer would destroy the seller's financial
records. Handle erasure requests by anonymising the profile (null out
`full_name`, `username`, `phone`, `bio`, `avatar_url`) rather than deleting the
row. Worth confirming against your jurisdiction's requirements.

## 7. Future improvements

Ordered by when you will actually need them:

1. **Switch search from `ilike` to full-text.** `search_vector` and its GIN
   index already exist and are unused. `ilike '%term%'` does not rank results
   and degrades past roughly 100k rows.
2. **Reviews and ratings** — `reviews` table constrained to buyers with a
   `delivered` order for that product, plus a denormalised `rating_avg` on
   `products` maintained by trigger.
3. **`order_status_history`** — the current `*_at` columns capture when a state
   was first reached but not who changed it. An append-only audit table is the
   usual next step, and often a compliance requirement.
4. **Payment records** — a `payments` table keyed by provider transaction ID,
   so refunds and partial captures have somewhere to live.
5. **Saved addresses** — a real table, with orders continuing to snapshot into
   `shipping_address` rather than referencing it.
6. **Categories closure table** — recursive CTEs on `parent_id` are fine to
   three or four levels; a closure table or `ltree` is better if the taxonomy
   grows deep.
7. **`unaccent`** — enable the extension and point `unaccent_fallback()` at it
   so "Café" and "Cafe" produce the same slug.
8. **Partition `orders` by `created_at`** — only once you are past a few
   million rows. Not before.
