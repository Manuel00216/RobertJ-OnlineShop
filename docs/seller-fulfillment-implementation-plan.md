# Seller Fulfillment — Implementation Architecture Plan

> **Status:** Planning only. No code, schema, migration, config, or UI changed by this document.
> **Prerequisite reading:** `docs/seller-fulfillment-audit.md` (Step 1) and its Step 2 validation. This plan assumes both.
> **Scope guardrails:** capstone-appropriate. **No** courier API, courier role, courier dashboard, GPS, ETA calculation, rate shopping, multi-parcel, or warehouse-management. Manual tracking entry only.
> **Non-negotiables (kept unchanged):** the `order_status` enum, `OrderTimeline`, `OrderStatusControl` as the single contextual control, the single write path, inventory/payment logic, the existing `orders`/`order_items` RLS + `enforce_order_update_rules` trigger, and the 3-role model.

Target flow (already the DB enum + existing labels — see audit headline):
`Pending (pending) → To Pack (confirmed) → Ready for Pickup (processing) → Shipped (shipped) → Delivered (delivered)`

---

## 1. Architecture decision

**Add one lightweight `order_shipments` table** (one row per seller order), written by seller/admin and read-only to the buyer, and **extend the existing `advanceOrderStatusAction` + `OrderStatusControl`** to (a) gate the To Pack → Ready-for-Pickup step behind an item-verification checklist and (b) capture courier + tracking at the Ready-for-Pickup → Shipped step. A printable label and a buyer tracking card read from the same table.

Key decisions, each grounded in the validated audit:

- **Separate table, not columns on `orders`.** The `orders` UPDATE policy is buyer-writable (`buyer_id = auth.uid()`) and `enforce_order_update_rules` only guards enumerated columns, so any new column on `orders` would be buyer-forgeable unless that sensitive financial/payment trigger were extended. A separate table gets its own RLS and **touches neither `orders` RLS nor the trigger** (satisfies requirement 6).
- **Per seller-order, never per `checkout_group_id`.** Each seller order is fulfilled and shipped independently (audit §6). `order_id` is `UNIQUE`.
- **Status backbone unchanged.** No enum change; reuse `STATUS_LABEL_MAP` / `ORDER_TIMELINE_STEPS` / `getOrderStatusLabel()`.
- **The Shipped transition carries data, so it needs an atomic write.** A small `SECURITY DEFINER` RPC `record_order_shipment` upserts tracking **and** flips `order_status` to `shipped` in one transaction. This is invoked *by the same action and the same control* — it is **not** a parallel user-facing shipment widget. Because the RPC runs with the seller's `auth.uid()`, the existing trigger's "only the seller changes fulfilment status" rule is satisfied with **no trigger change**.
- **No new npm dependency.** Label printing = a dedicated print route + `@media print` + `window.print()`. Barcode = **out of scope for v1** (no scanning workflow exists); if ever wanted, an in-repo inline-SVG Code128 generator (no dependency, CSP-safe) is the only sanctioned route.
- **DB-level strict transition enforcement: not added.** Per Step 2, the only bypass is a seller manipulating their own order; app-level `ORDER_STATUS_TRANSITIONS` remains the sequence guard. The verification gate and "tracking required before shipped" are enforced in the action/RPC, not the trigger.

---

## 2. Data model

New table `public.order_shipments`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `default gen_random_uuid()` | |
| `order_id` | `uuid` NOT NULL, **UNIQUE**, FK → `orders(id)` | one shipment per seller order |
| `seller_id` | `uuid` NOT NULL, FK → `profiles(id)` | **denormalized** from the order for cheap RLS write checks (same precedent as `return_requests.seller_id`) |
| `packed_at` | `timestamptz` NULL | set when the seller verifies items and moves To Pack → Ready for Pickup |
| `courier` | `text` NULL | free-text courier name (manual); `CHECK (char_length(courier) between 1 and 80)` when not null |
| `tracking_number` | `text` NULL | manual tracking ref; `CHECK (char_length(tracking_number) between 1 and 120)` when not null |
| `shipped_at` | — | **not stored here** — reuse `orders.shipped_at` (trigger-stamped); the table never duplicates it |
| `created_at` | `timestamptz` NOT NULL `default now()` | |
| `updated_at` | `timestamptz` NOT NULL `default now()` | `moddatetime`/existing `updated_at` trigger pattern |

**Constraints / integrity:**
- `UNIQUE (order_id)` — enforces one-per-order and doubles as the lookup index.
- FK `order_id` `on delete cascade`? **No** — orders are never deleted (no DELETE policy); use plain FK (restrict). Consistent with financial-immutability convention.
- Table-level `CHECK`: if `order_status` reaches `shipped` both `courier` and `tracking_number` should be present — but this cross-table rule is enforced in the RPC (a CHECK can't see `orders`), so **no cross-table CHECK** (documented, same style as the products↔inventory note in ARCHITECTURE.md).

**Indexes:**
- `UNIQUE (order_id)` (implicit index) — the primary access path (`getOrderShipment(orderId)`).
- `order_shipments_seller_id_idx (seller_id)` — optional, only if a seller-wide shipment list is later needed; **omit for v1** (no such screen).

**Relationships:** `order_shipments (order_id) → orders (id)` 1:1; buyer/seller reach it through the order they already own.

---

## 3. RLS / security design

Enable RLS; no direct table grants beyond what the policies allow. Buyers get **SELECT only**; they can never INSERT/UPDATE/DELETE (requirement 6).

```sql
alter table public.order_shipments enable row level security;

-- READ: buyer, seller, or admin of the parent order (mirrors return_requests SELECT).
create policy "participants read order shipments"
  on public.order_shipments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.buyer_id = (select auth.uid())
             or o.seller_id = (select auth.uid())
             or public.is_admin())
    )
  );

-- WRITE: seller of the order (or admin) only. Buyers excluded entirely.
create policy "seller or admin insert own order shipment"
  on public.order_shipments for insert to authenticated
  with check (
    (public.is_admin())
    or (
      seller_id = (select auth.uid())
      and exists (select 1 from public.orders o
                  where o.id = order_id and o.seller_id = (select auth.uid()))
    )
  );

create policy "seller or admin update own order shipment"
  on public.order_shipments for update to authenticated
  using (seller_id = (select auth.uid()) or public.is_admin())
  with check (seller_id = (select auth.uid()) or public.is_admin());

-- No DELETE policy → all deletes denied (fulfillment record is retained).
```

- **`record_order_shipment` RPC** (`SECURITY DEFINER`, `search_path = ''`): re-checks `is_admin() or order.seller_id = auth.uid()`, requires `order_status = 'processing'`, upserts the shipment row (`courier`, `tracking_number`), and sets `orders.order_status = 'shipped'` — all in one transaction. `EXECUTE` granted to `authenticated`. Runs as the caller's `auth.uid()`, so `enforce_order_update_rules` passes unchanged.
- **`packed_at` write** (To Pack → Ready for Pickup): a plain RLS-scoped upsert from the service layer (non-sensitive, advisory timestamp) — no RPC needed. If strict atomicity is later desired, mirror it as an RPC; not required for v1.
- **Existing `orders` RLS and `enforce_order_update_rules`: untouched.**
- **UNVERIFIED:** live cross-seller write attempts were not executed; design follows the verified `return_requests`/`payments` precedents.

---

## 4. Seller fulfillment flow (per step, single control)

`OrderStatusControl` remains the **only** control. Each step keeps exactly one primary button; the button opens step-specific UI where data/verification is required, then submits through `advanceOrderStatusAction`.

| Current status | Button (existing verb) | Behavior added |
|---|---|---|
| `pending` (Pending) | **Confirm order** | unchanged → `advanceOrderStatus(confirmed)` |
| `confirmed` (To Pack) | **Verify items** *(relabel of "Mark ready for pickup")* | opens an **item-verification checklist** (all order lines, with variant label + quantity, from props). All lines must be checked to enable submit → advances to `processing` **and** records `packed_at`. |
| `processing` (Ready for Pickup) | **Prepare & print label** + **Mark as shipped** | "Prepare & print label" links to the print route (§6); "Mark as shipped" opens an inline **courier + tracking** form (required) → calls `record_order_shipment` RPC (atomic tracking + `shipped`). |
| `shipped` (Shipped) | **Mark as delivered** | unchanged → `advanceOrderStatus(delivered)` |
| `delivered` (Delivered) | — | unchanged (returns entry point already exists) |
| any cancellable | **Cancel order** | unchanged |

- **Payment gate unchanged:** unpaid Xendit orders still block forward advancement (`paymentRequired`).
- The "Prepare & print label" affordance is a **link**, not a second status control — it changes no state.

### Item verification — stored or gate?
**Both, minimally.** The per-line checklist is a **client-side transition gate** (you cannot advance until every line is confirmed); the server does **not** store which items were ticked (no WMS). It **does** persist a single `packed_at` timestamp as a lightweight audit that verification/packing occurred. Rationale: satisfies "verify before packing" and gives an audit trail without per-item verification records.

---

## 5. Tracking capture

- Fields: `courier` (free text, with a non-authoritative `<datalist>` of common PH couriers — J&T, LBC, Ninja Van, Flash, JRS, GrabExpress — plus free entry) and `tracking_number` (free text). **Manual only**; no courier API, no validation against any carrier.
- **Required before "Mark as shipped".** Enforced in `advanceOrderStatusAction` (Zod) **and** in `record_order_shipment` (rejects empty courier/tracking). The button's form cannot submit empty.
- **Same write path:** `advanceOrderStatusAction(orderId, "shipped", { courier, trackingNumber })`. Internally routes to the RPC; no separate user-facing action/button.
- Editing after shipping: allow the seller to correct a typo while `shipped` (UPDATE policy permits it); surface a small "Edit tracking" affordance on the seller detail page only (not a new control on the timeline). *(Optional for v1; can defer.)*

---

## 6. Printable RobertJ shipping label

- **Route:** `src/app/seller/orders/[id]/label/page.tsx` — a dedicated, chrome-free print view (Server Component), gated by `requireSessionUser` + `getDashboardOrder(id, user.id)` (RLS-scoped; a seller can only reach their own order's label). A small client `PrintLabelButton` calls `window.print()`.
- **Print styling:** a scoped `@media print` block (hide nav/buttons, fixed label dimensions ~4"×6" or A6). No PDF library.
- **Contents (all from existing data):**
  - RobertJ wordmark + "Shipping Label".
  - **Order number** (prominent) and placed date.
  - **Ship to:** full `shipping_address` snapshot (name, lines, barangay/city/province/region, postal, country, phone) via existing `ShippingAddress`.
  - **Ship from:** shop name (resolved as on the order detail page).
  - **Item summary:** titles + variant label + quantity (from `order.items`).
  - **Courier + tracking number** (from `order_shipments`).
- **Barcode: out of scope for v1.** No scanning workflow (no courier API/handheld) makes a scannable code decorative. Show a large monospaced order number and tracking number instead. *If* later required, generate an inline-SVG Code128 from a small in-repo utility (no npm dependency, no external asset — CSP-safe); do not add a barcode library.
- **CSP/Next.js:** print view is fully self-contained (inline styles/SVG, no external fonts/scripts); `window.print()` is client-side and allowed.

---

## 7. Buyer tracking flow

- **Component:** `ShipmentTrackingCard` (read-only), added to `src/app/(account)/orders/[id]/page.tsx`.
- **Placement:** shown when `order.status` is `shipped` (buyer "To Receive") or `delivered` ("Completed") — the `buyer_order_lifecycle` view already maps `shipped → to_receive`, so **no view change**.
- **Data:** fetched separately in the page via `getOrderShipment(order.id)` (RLS lets the buyer read their own order's shipment) — mirrors how `activePayment`/`returnRequest` are fetched separately, so **no change to the shared `Order` type or `toOrder` mapper**.
- **Shows:** courier, tracking number, and shipped date (`order.shippedAt`). Nothing else — **no ETA, no map, no courier API**. If courier/tracking are null (e.g., an older shipped order), render a graceful "Tracking details will appear here once your seller adds them" empty state.

---

## 8. Multi-seller behavior

- Every seller order (each row produced by `groupCartBySeller`) gets **its own** `order_shipments` row (`UNIQUE (order_id)`), its own verification, its own label, and its own tracking.
- **Never** one shipment per `checkout_group_id`. The group id is irrelevant to fulfillment; it exists only for combined payment (audit §6).
- Buyer viewing a multi-seller order sees each order's tracking on that order's own detail page (orders are already separate rows/pages).

---

## 9. Database / migration plan

New migration `supabase/migrations/20260928000000_order_shipments.sql` (timestamp to be finalized as the next in sequence; the current tail is `20260927040000`). Transactional (`begin/commit`), idempotent, additive:

1. `create table if not exists public.order_shipments (...)` with columns/constraints from §2.
2. `UNIQUE (order_id)`; `updated_at` trigger (reuse existing `moddatetime`/`set_updated_at` convention).
3. `alter table ... enable row level security;` + the four policies from §3.
4. Least-privilege grants: `grant select, insert, update on public.order_shipments to authenticated;` (deletes denied by absent policy). No `anon` grant.
5. `create function public.record_order_shipment(p_order_id uuid, p_courier text, p_tracking_number text) returns ... security definer set search_path = ''` implementing the ownership + `processing`→`shipped` + upsert logic; `revoke all ... from public/anon`; `grant execute ... to authenticated`.
6. **No** change to the `order_status` enum, `orders`/`order_items` RLS, or `enforce_order_update_rules`.

**Type + constant updates:**
- Regenerate `src/lib/supabase/database.types.ts` (`npx supabase gen types typescript --project-id <id> > ...`), per Migration Policy (TD-8 resolved — types are generated).
- Add `ORDER_SHIPMENTS: "order_shipments"` to `DATABASE_TABLES` (`src/constants/database.ts`).

---

## 10. Files / components / actions to modify or add

**Add:**
- `supabase/migrations/20260928000000_order_shipments.sql` (table, RLS, RPC).
- `src/features/orders/types/order.types.ts` → add `OrderShipment` domain type (`{ orderId, courier, trackingNumber, packedAt, shippedAt }`).
- `src/features/orders/schemas/order.schema.ts` → add `recordShipmentSchema` (`orderId`, `courier` 1–80, `trackingNumber` 1–120); extend the advance payload validation for the `shipped` case.
- `src/features/orders/components/ItemVerificationChecklist.tsx` (client) — the To Pack gate UI.
- `src/features/orders/components/ShipmentCaptureForm.tsx` (client) — courier/tracking form used inside `OrderStatusControl` for the shipped step.
- `src/features/orders/components/ShipmentTrackingCard.tsx` — buyer read-only tracking.
- `src/app/seller/orders/[id]/label/page.tsx` + `PrintLabelButton.tsx` — print label route/button.
- (label) `src/features/orders/components/ShippingLabel.tsx` — the print layout.

**Modify:**
- `src/features/orders/components/OrderStatusControl.tsx` — host the checklist (processing step) and capture form (shipped step); accept `items` + shipment props; keep one button per step.
- `src/features/orders/actions/order.actions.ts` — extend `advanceOrderStatusAction` to accept an optional shipment payload; add internal routing to `record_order_shipment` for the shipped transition and `packed_at` recording for the processing transition. Keep it the single action.
- `src/lib/supabase/queries.ts` — add `getOrderShipment(orderId)`, `recordOrderShipment(...)` (wraps RPC), `markOrderPacked(orderId)` (RLS upsert); reuse `ORDER_COLUMNS`/`toOrder` unchanged.
- `src/app/(account)/orders/[id]/page.tsx` — fetch + render `ShipmentTrackingCard` in shipped/delivered states.
- `src/app/seller/orders/[id]/page.tsx` (and `admin/orders/[id]/page.tsx`) — pass `items` to `OrderStatusControl`; add the "Prepare & print label" link.
- `src/constants/database.ts`, `src/constants/routes.ts` (add `sellerOrderLabel(id)` route), `database.types.ts`.
- `MODULES.md`, `ARCHITECTURE.md` (see §12).

---

## 11. Implementation sequence (backend/data-first, each step lint/typecheck/build-green)

1. **Migration + types:** create `order_shipments`, RLS, `record_order_shipment` RPC; regenerate `database.types.ts`; add `DATABASE_TABLES` constant. Verify RLS with rolled-back SQL (seller-writes-own, buyer-read-only, buyer-write-denied).
2. **Service layer:** `getOrderShipment`, `recordOrderShipment`, `markOrderPacked` in `queries.ts`.
3. **Action + schema:** extend `advanceOrderStatusAction` + `recordShipmentSchema`.
4. **Seller control UI:** `ItemVerificationChecklist`, `ShipmentCaptureForm`, wire into `OrderStatusControl`; pass items from seller/admin detail pages.
5. **Label:** `ShippingLabel`, print route, `PrintLabelButton`, `ROUTES.sellerOrderLabel`.
6. **Buyer tracking:** `ShipmentTrackingCard` on buyer detail.
7. **Docs:** update MODULES.md/ARCHITECTURE.md (+ migration list), then full validation.

---

## 12. Documentation & validation

**Docs to update:**
- `MODULES.md` — Orders module: add `order_shipments` table, new components/actions/queries, and the fulfillment/tracking capability.
- `ARCHITECTURE.md` — add `order_shipments` to the current tables list, describe `record_order_shipment` under the RPC section, and **fix the migration-list drift** (it currently stops at `20260925`; add `20260926`/`20260927xxxx` and the new `20260928000000`). Note that fulfillment transitions have no inventory/payment effect.
- Update the stale `refunded` comment note if touched (optional).

**Validation checklist:**
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` all green.
- [ ] RLS (rolled-back SQL, per the repo's no-browser verification method): seller can insert/update own order's shipment; **buyer SELECT works, buyer INSERT/UPDATE denied**; seller B cannot write seller A's shipment; admin can read/write any.
- [ ] `record_order_shipment` rejects: non-owner, order not in `processing`, empty courier/tracking; succeeds atomically (tracking saved **and** status flips to `shipped`).
- [ ] Verify-items gate: advance to `processing` blocked until all lines checked; `packed_at` recorded.
- [ ] Multi-seller: two orders from one checkout each get an independent shipment/label/tracking; no group-level shipment created.
- [ ] Buyer tracking card shows courier/tracking/shipped date in To Receive; graceful empty state when null; hidden pre-shipment.
- [ ] Label prints (`@media print`) with correct order number, ship-to/ship-from, items, courier, tracking; no dashboard chrome; no external asset.
- [ ] No change to `orders`/`order_items` RLS or `enforce_order_update_rules`; enum unchanged; inventory/payment behavior unchanged.
- [ ] `database.types.ts` regenerated and committed.

**Migration doc drift identified (fix during Step 12):** ARCHITECTURE.md migration list ends at `20260925`; the tree already contains `20260926000000`, `20260927000000`, `20260927010000`, `20260927020000`, `20260927030000`, `20260927040000`.

---

## 13. Risks & out-of-scope

**Risks:**
- **Two-write atomicity at the shipped step** — mitigated by doing it inside `record_order_shipment` (single transaction). The `packed_at` write is intentionally non-atomic (advisory); acceptable.
- **`OrderStatusControl` complexity** — it gains step-specific UI. Mitigation: extract the checklist and capture form into their own components; keep the control's branching thin. Don't fork a second control.
- **Print fidelity across browsers** — `window.print()` + `@media print` varies; keep the label simple and test in Chrome (primary). No PDF guarantee.
- **Older shipped orders** have no shipment row → buyer/label must handle null gracefully (designed for).
- **UNVERIFIED:** live multi-tenant RLS behavior and cross-browser print output — to be exercised during Step 11–12, not assumed here.

**Intentionally out of scope (do not build):**
- Courier API integration, live/real tracking sync, ETA, maps/GPS, rate shopping, label/postage purchase.
- A courier role or courier dashboard.
- Multi-parcel / split shipments per order; per-item shipment records; barcode scanning workflow (barcode itself deferred).
- Warehouse-management (bins, pick lists, stock reservations beyond the existing `create_order` decrement).
- Auto-advancing status from any external signal.
- Changing the `order_status` enum or introducing `to_pack`/`ready_for_pickup` enum members (labels already cover this).

---

### Sign-off
This plan keeps the entire existing status/inventory/payment/RLS backbone intact, adds exactly one small table + one RPC + read-only buyer surface, and enriches the single existing control. It is implementable incrementally with each step build-green. **No implementation performed.**
