# RobertJ Online Shop — Database Audit & ERD

**Scope:** Supabase project `hjxtbnmnwlbqgptgncoh` (Postgres 17), schema `public`.
**Date:** 2026-10-11 · **Method:** read-only catalog queries (`pg_class`, `pg_constraint`, `pg_indexes`, `pg_policies`, grants), Supabase security/performance advisors, and a few `COUNT(*)` integrity checks. **Nothing in the database was modified.**

## Diagrams

| File | Contents |
|---|---|
| [`robertj-erd-overview.png`](./robertj-erd-overview.png) / [`.svg`](./robertj-erd-overview.svg) | Entire database on one canvas: 25 tables, 1 view, `auth.users` stub, all 60 FKs |
| [`robertj-erd-detail-1-identity-shops-customer`](./robertj-erd-detail-1-identity-shops-customer.png) | profiles, addresses, preferences, shops, shop_users, admin log, cart, wishlists |
| [`robertj-erd-detail-2-catalog-inventory`](./robertj-erd-detail-2-catalog-inventory.png) | categories, products, variants, images, recommendation rules, inventory, stock history |
| [`robertj-erd-detail-3-orders-payments-returns`](./robertj-erd-detail-3-orders-payments-returns.png) | orders, items, shipments, reviews, payments, webhooks, refunds, returns |

PNGs are 2× resolution (overview 5280×5468). SVGs are vector and zoom without loss. Regenerate with `generator/` (needs `python3` + headless Chromium; the table/FK data in `erd.py` was copied from the live catalog).

Edge colour = FK delete rule (red CASCADE, amber SET NULL, blue RESTRICT, grey NO ACTION); dashed = logical link without an FK constraint.

## Schema at a glance

- **25 tables + 1 view** (`buyer_order_lifecycle`, `security_invoker=true`), **60 FKs**, 12 enums, 62 functions, 4 storage buckets. RLS is enabled on **every** table.
- Live row counts are tiny (largest: `stock_adjustments` 387, `payments` 175, `order_items` 176, `orders` 163), so most findings are about *correctness and hygiene before growth*, not present-day slowness.
- `profiles` is the hub: 22 FKs point at it.
- Money is consistently integer cents; every PK is `uuid`.

## Findings

Severity: **H** high · **M** medium · **L** low/hygiene.

### Security

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| S1 | **M** | `anon` (and `authenticated`) hold **all table privileges incl. TRUNCATE/TRIGGER/REFERENCES** on 7 tables: `admin_action_log`, `inventory`, `order_idempotency_keys`, `order_shipments`, `product_variants`, `return_requests`, `stock_adjustments`. RLS blocks row access, but TRUNCATE is not governed by RLS and the grants violate least privilege (likely default privileges from later migrations). `authenticated` also has DML grants on the view `buyer_order_lifecycle`. | `information_schema.role_table_grants` | New migration: `REVOKE ALL ON <tables> FROM anon, authenticated;` then re-grant only the needed verbs (the pattern already used for `orders`, `payments`, `products`). `ALTER DEFAULT PRIVILEGES … REVOKE ALL ON TABLES FROM anon, authenticated` to stop recurrence. |
| S2 | **M** | `check_rate_limit(text,int,int)` is `SECURITY DEFINER` and executable by **anon**; it writes `rate_limit_hits` with a caller-chosen key, so anyone can exhaust another user's/IP's bucket or bloat the table. | Advisor 0028; function has no `auth.uid()` | `REVOKE EXECUTE … FROM anon, authenticated` and call it from server code with the service role only. |
| S3 | L | Trigger functions `enforce_username_change_once` and `set_order_shipment_shop_id` are executable via `/rest/v1/rpc` by anon/authenticated (cannot actually run outside a trigger, but widen the surface). | Advisors 0028/0029 | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`. |
| S4 | L | 11 anon-callable DEFINER functions: 3 are intentionally public (`get_marketplace_stats`, `get_product_sold_counts`, `get_variant_stock`); `confirm_order_received` is anon-executable although it only makes sense signed-in; `is_admin`, `current_user_role`, `is_shop_member`, `resolve_shop_membership` are RLS helpers. All have `search_path` set. | Advisor + `pg_proc` scan (only 8 DEFINER fns lack an `auth.uid()` reference) | Revoke anon on `confirm_order_received`; keep the rest, document the public ones. |
| S5 | L | Auth: **leaked-password protection disabled.** | Advisor `auth_leaked_password_protection` | Enable in Dashboard → Auth → Passwords. |
| S6 | info | `order_idempotency_keys`, `payment_webhook_events`, `rate_limit_hits`: RLS on, **no policies** → deny-all for API roles. This looks intentional (service-role only). | Advisor 0008 | Add a `COMMENT ON TABLE … 'service-role only'` so the advisor finding is understood, not "fixed" by accident. |
| S7 | L | PII/provider payloads stored indefinitely: `addresses`, `orders.shipping_address` (snapshot), `payments.provider_response`, `payment_webhook_events.raw_payload`, `xendit_refunds.raw_response`. | Schema | Define retention (e.g. prune raw webhook payloads after N days); ensure none are readable by buyers/sellers via RLS beyond need. |

### Data-model design

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| D1 | **M** | **Two sources of truth for stock**: `products.quantity` and `inventory.quantity` (per product or per variant). Currently in sync (0 drifted rows), but only by convention. | `products.quantity`, `inventory`; drift query = 0 | Pick one owner. Either derive `products.quantity` (view/trigger from `inventory`) or drop it. |
| D2 | **M** | **Ownership denormalised and unconstrained**: `seller_id` *and* `shop_id` on `orders`, `products`, `product_variants`, `order_shipments`, `return_requests`, `recommendation_rules`; `shop_id` also on `inventory`/`stock_adjustments`. Nothing forces them to agree. **7 orders** have items whose product's shop ≠ the order's shop; **5 orders** have `shop_id IS NULL`; **2 products** have no shop. | Integrity queries | Decide whether `seller_id` or `shop_id` is canonical (migrations already moved toward `shop_id`). Backfill NULLs, then `SET NOT NULL`, and consider composite FKs (e.g. `(product_id, shop_id)`) or a trigger. Investigate the 7 mismatches. |
| D3 | **M** | Many ownership FKs are nullable with `ON DELETE SET NULL`: **130 of 163 orders** have `seller_id IS NULL`, **25 of 100 products** have no seller. `orders_buyer_is_not_seller` (`buyer_id <> seller_id`) silently passes when `seller_id` is NULL. | Counts above | Confirm these are test data from hard-deleted sellers; if not, preserve the seller/shop reference (soft-delete) on financial rows. |
| D4 | **M** | **Legacy QR / manual-verification residue** after the Xendit migration: `payments.receipt_path`, `verified_by`, `verified_at`; enum `payment_method_type` still has `qr_upload`/`card` (default `'card'`); `profiles.payment_qr_url` (0 rows use it) with its CHECK; private `payment-receipts` bucket (1 object); 1 `qr_upload/paid` payment row. Two overlapping enums describe the payment method (`payments.payment_method_type` vs `orders.payment_method`). **README/CLAUDE.md still describe COD + QR as the target.** | Columns, enums, storage, data | Decide and record in `DECISIONS.md`. If QR is gone: archive then drop those columns/bucket; collapse to one enum. Update the Implementation Status table. |
| D5 | L | `products_price_sane` is a **dead CHECK**: `price_cents <= 100000000000` on an `integer` column (max 2,147,483,647). Real cap per item/order is ≈ ₱21.4 M (`int4` cents). | Check constraint + type | Tighten the CHECK to a business limit, or widen to `bigint` if larger totals are conceivable. |
| D6 | L | Weakly typed status-like text: `payment_webhook_events.event_type/status/processing_result`, `payments.payment_channel`, `buyer_preferences.default_payment_method` (CHECK instead of enum). `xendit_refunds.currency` is `text` whereas elsewhere `char(3)` with a format CHECK. | Columns | Add CHECKs or enums; make currency consistent. |
| D7 | L | Lifecycle timestamps are not tied to status: only `paid_at` has a CHECK. `shipped_at`, `delivered_at`, `cancelled_at`, `buyer_confirmed_received_at` can contradict `order_status`. `order_status` also has `refunded` which overlaps `payment_status`. | Check constraints | Add CHECKs (e.g. `cancelled_at IS NOT NULL ⇔ order_status='cancelled'`) or enforce solely in RPCs and document it. |
| D8 | L | `payments` uniqueness is `(xendit_payment_id, order_id)` and `(xendit_payment_request_id, order_id)`; NULLs are distinct so pending rows are unconstrained. Multiple payment rows per order are by design (retries), but nothing limits it to one *active* attempt. 3 grouped orders have no group payment row. | Constraints; `checkout_group_id` query | Consider a partial unique index on `(order_id) WHERE status='pending'`; review the 3 orphaned group orders. `checkout_group_id` link (orders↔payments) has no FK or parent table (dashed in ERD). |
| D9 | info | `product_variants` and `recommendation_rules` have 0 rows; `categories` has 4. Features are built but unused so far. | Counts | Nothing to fix; keep in mind when judging "unused" indexes. |
| D10 | info | Good practice present: integer cents + `*_matches` CHECKs, unique partial indexes for default address / open returns / cart items, FK `RESTRICT` on financial history, idempotency keys, audit log, `security_invoker` view, bucket MIME/size limits. | — | Keep. |

### Performance

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| P1 | M | **5 foreign keys without a covering index** (advisor 0001): `order_items.variant_id`, `order_shipments.seller_id`, `recommendation_rules.variant_id`, `return_requests.condition_recorded_by`, `stock_adjustments.variant_id`. `variant_id` joins/cascades will seq-scan once variants are used. | `CREATE INDEX CONCURRENTLY` on each (SQL below). |
| P2 | L | **Redundant indexes** (prefix duplicates): `product_images_product_id_sort_idx` ≡ unique `product_images_unique_position`; `shop_users_shop_id_idx` ⊂ `shop_users_unique_membership`; `shop_users_user_id_idx` ≡ `shop_users_unique_user`; `wishlists_user_id_idx` ⊂ `wishlists_unique_item`; `carts_user_id_idx` ≡ `carts_one_per_user` (which exists as both a constraint and a unique index); `products_seller_id_idx` ⊂ `products_seller_status_created_idx`; `orders_seller_id_created_idx` ≈ `orders_seller_placed_idx`. | Drop after confirming with `pg_stat_user_indexes` on production traffic. |
| P3 | L | 11 "unused" indexes (advisor 0005), incl. all three product search indexes (`search_vector` GIN, `title` trigram, `tags` GIN). At ~100 rows Postgres prefers seq scans, so *unused ≠ useless*. | Re-evaluate once catalogue/traffic grows; don't drop search indexes now if the app uses them. |
| P4 | L | `shops` has two permissive `UPDATE` policies for `authenticated` (advisor 0006) → both evaluated per row. | Merge into one policy with `OR`. |
| P5 | L | Unbounded growth, no purge job visible (`pg_cron` not installed): `rate_limit_hits`, `order_idempotency_keys`, `payment_webhook_events`, `admin_action_log`, `stock_adjustments`. `products.views_count` is an in-row counter (hot-row churn if incremented per view). | Scheduled cleanup (pg_cron or Edge Function); move view counting to a batched/side table. |
| P6 | L | `uuid-ossp` and `pgcrypto` are installed though `gen_random_uuid()` is built in. | Drop unused extensions if nothing references them. |

## Suggested SQL (NOT executed — for review as new migrations)

```sql
-- P1: cover unindexed FKs
create index concurrently if not exists order_items_variant_id_idx            on public.order_items (variant_id);
create index concurrently if not exists order_shipments_seller_id_idx         on public.order_shipments (seller_id);
create index concurrently if not exists recommendation_rules_variant_id_idx   on public.recommendation_rules (variant_id);
create index concurrently if not exists return_requests_condition_recorded_by_idx on public.return_requests (condition_recorded_by);
create index concurrently if not exists stock_adjustments_variant_id_idx      on public.stock_adjustments (variant_id);

-- S1: least-privilege grants (re-grant only what the app needs afterwards)
revoke all on public.admin_action_log, public.inventory, public.order_idempotency_keys,
              public.order_shipments, public.product_variants, public.return_requests,
              public.stock_adjustments, public.buyer_order_lifecycle
  from anon, authenticated;
-- then e.g.: grant select, insert, update, delete on public.product_variants to authenticated; grant select on public.product_variants to anon;

-- S2/S3/S4: function exposure
revoke execute on function public.check_rate_limit(text,int,int)  from public, anon, authenticated;
revoke execute on function public.confirm_order_received(uuid)    from public, anon;
revoke execute on function public.enforce_username_change_once()  from public, anon, authenticated;
revoke execute on function public.set_order_shipment_shop_id()    from public, anon, authenticated;
```

Validate each statement against the app (policies, `scripts/e2e-flow.mjs`) before shipping; project rules require migrations to be transactional, idempotent and followed by regenerating `database.types.ts`.

## Priority order

1. **S1, S2** — least-privilege grants and rate-limit function exposure.
2. **D2/D3** — decide canonical owner (`shop_id`), backfill NULLs, investigate the 7 shop mismatches.
3. **D4** — close out the QR flow (schema + docs) so the schema and README agree.
4. **P1** — add the 5 FK indexes.
5. **D1** — single source of truth for stock.
6. Remaining low-severity hygiene (D5–D8, P2–P6, S5–S7).

## Limits of this audit

Based on catalog metadata, advisors and row counts only. Function bodies were scanned for `auth.uid()`/role checks but **not** fully reviewed; RLS policy *predicates* were not individually reviewed (only policy counts/roles). "Unused index" data comes from stats since the last reset on a small dataset.
