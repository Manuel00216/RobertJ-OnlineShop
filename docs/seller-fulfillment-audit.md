# Seller → Order → Fulfillment → Buyer Flow — Read-Only Audit

> **Status:** Read-only audit. No code, schema, migration, config, or UI was modified.
> **Date:** 2026-09-25 · **Branch:** `fix/audit-fix-now-batch`
> **Purpose:** Understand how the current architecture handles the seller fulfillment flow *before* introducing any new fulfillment features (progress bar, item verification, printable shipping label, courier/tracking). No implementation is proposed here beyond a final "recommended next step."
> **Method:** Static reading of `src/features/orders`, `src/features/payments`, `src/features/returns`, `src/features/inventory`, `src/app/seller/orders/**`, `src/app/(account)/orders/**`, `src/lib/supabase/queries.ts`, and `supabase/migrations/*.sql`. Live multi-tenant / Xendit-sandbox behavior was **not** exercised; such points are marked **UNVERIFIED**.

---

## Headline finding (read this first)

**The target status flow already exists in the database and is already labelled with the exact target names.** The DB enum `order_status` is `pending → confirmed → processing → shipped → delivered` (+ `cancelled`, `refunded`), and the app already maps it to the target vocabulary:

`src/features/orders/constants/order.constants.ts:34-42`
```ts
export const STATUS_LABEL_MAP: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "To Pack",          // ← target "To Pack"
  processing: "Ready for Pickup",// ← target "Ready for Pickup"
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
```
The comment at lines 29-33 states this was a deliberate decision: *"The capstone proposal names statuses differently than the DB enum — 'To Pack' = confirmed, 'Ready for Pickup' = processing — so the mapping is documented here instead of changing the schema."*

**Consequence:** the target flow `Pending → To Pack → Ready for Pickup → Shipped → Delivered` needs **no enum/schema change** for the status backbone. The gap is entirely in **fulfillment enrichment** (item verification, shipping label, courier/tracking capture + display), none of which exists today.

---

## 1. Current architecture and order lifecycle

**Layering (unchanged from the documented architecture, verified in code):** Page (Server Component) → Server Action (`ActionResult<T>`, Zod, `requireRole`) → service layer (`queries.ts`, the only `.from()`/`.rpc()` caller) → Postgres RPC + RLS.

**Order lifecycle (DB enum, `supabase/migrations/20260802000100_initial_schema.sql:48`):**
`pending | confirmed | processing | shipped | delivered | cancelled | refunded`.

| DB status | Target label | Who advances into it | Timestamp stamped |
|---|---|---|---|
| `pending` | Pending | buyer (`create_order`) | `placed_at` (default) |
| `confirmed` | To Pack | seller/admin | — |
| `processing` | Ready for Pickup | seller/admin | — |
| `shipped` | Shipped | seller/admin | `shipped_at` (trigger) |
| `delivered` | Delivered | seller/admin | `delivered_at` (trigger) |
| `cancelled` | Cancelled | buyer (`pending`/`confirmed`) or seller/admin (through `processing`) | `cancelled_at` (+ `cancelled_by`, `cancellation_reason`) |
| `refunded` | Refunded | **not reachable via order-status flow** — see §9 | — |

Timestamps are trigger-set (`track_order_status_timestamps`, `20260802000100_initial_schema.sql:584-588` for shipped/delivered) — clients never write them.

**`orders` table columns (verified, `src/lib/supabase/database.types.ts`):**
`buyer_id, seller_id, order_number, order_status, payment_status, payment_method, subtotal_cents, shipping_fee_cents, total_cents, currency, shipping_address (jsonb), notes, checkout_group_id, placed_at, paid_at, shipped_at, delivered_at, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at`.
There is **no** `tracking_number`, `courier`, `carrier`, `waybill`, `shipping_label`, or `tracking_url` column. There is a `shipping_fee_cents` and a `shipping_address` jsonb snapshot, but no courier/tracking data model at all.

---

## 2. Existing seller fulfillment functionality

**Seller order list** — `src/app/seller/orders/page.tsx`: search (`OrderSearchInput`) + status filter (`OrderStatusFilter`) + `DashboardOrdersPanel` (RLS-scoped via `getDashboardOrder`/`listDashboardOrders`), linking to `ROUTES.sellerOrderDetail`.

**Seller order detail** — `src/app/seller/orders/[id]/page.tsx`:
- `OrderHeader` + `OrderTimeline` (progress stepper, §3) + `OrderStatusControl` (the contextual action).
- Return handling (`ReturnRequestStatusCard` / `RespondToReturnPanel`).
- `OrderItemsList` + `ShippingAddressCard` + `OrderSummary` + Buyer/Payment card.
- `MarkCodCollectedButton` when `paymentStatus === "pending"`.

**Contextual fulfillment control** — `src/features/orders/components/OrderStatusControl.tsx`: this **already is** the "contextual action = seller's required next action" concept the target describes. It computes the single next forward step from `ORDER_STATUS_TRANSITIONS[status]` (`:49-50`) and renders one action button plus (separately) a cancel button. Action verbs (`:14-19`):
```ts
confirmed: "Confirm order",
processing: "Mark ready for pickup",
shipped: "Mark as shipped",
delivered: "Mark as delivered",
```
It also blocks forward advancement for an unpaid Xendit order (`paymentRequired`, `:79-84`) with an explanatory message. Both forward-advance and cancel go through one write path (`advanceOrderStatusAction`).

**Payment collection** — `MarkCodCollectedButton` (COD) on the detail page; Xendit is webhook-confirmed (no seller action).

---

## 3. Existing buyer order/tracking functionality

**Buyer order list** — `src/app/(account)/orders/page.tsx` with Shopee-style lifecycle tabs (`order-lifecycle.constants.ts`): `to_pay, to_ship, to_receive, completed, cancelled, return_refund`, computed by the `buyer_order_lifecycle` SQL view (`20260923000000_buyer_order_lifecycle_view.sql`) — not recomputed in components.

**Buyer order detail** — `src/app/(account)/orders/[id]/page.tsx`:
- `OrderHeader` + `OrderTimeline` (same stepper the seller sees).
- Cancel (when `order.cancellable`) + Buy Again.
- "Go to Checkout" payment CTA for unpaid/failed Xendit (`:141-161`).
- Return request panel (delivered, or cancelled-and-paid).
- `SellerShopRow`, `OrderItemsList`, `OrderSummary`, Payment Information card.

**Tracking visibility today:** the buyer sees the **status stepper only**. There is **no** shipment/tracking section, no courier name, no tracking number, no delivery ETA — because none of that data is captured (§7). The buyer's "shipment info" is currently just the `shipped` step lighting up on the timeline.

---

## 4. Current status transition logic and enforcement

Three layers, verified:

**App-level transition map** — `order.constants.ts:81-89`:
```ts
pending:    ["confirmed", "cancelled"],
confirmed:  ["processing", "cancelled"],
processing: ["shipped", "cancelled"],
shipped:    ["delivered"],
delivered:  [], cancelled: [], refunded: [],
```
Buyer cancel window is narrower: `CANCELLABLE_ORDER_STATUSES = ["pending","confirmed"]` (`:65-68`).

**Server action enforcement** — `advanceOrderStatusAction` (`order.actions.ts:104-139`): Zod → `requireRole(DASHBOARD_ROLES)` → rate-limit → (for cancel) stale-Xendit reconciliation guard → `queries.advanceOrderStatus(orderId, newStatus, admin ? null : user.id)`.

**Service enforcement** — `queries.advanceOrderStatus` (`queries.ts:2037-2088`): reads current status **filtered by `seller_id`** for non-admins (`:2048`), validates the transition against `ORDER_STATUS_TRANSITIONS` (`:2060-2065`), applies the unpaid-Xendit forward guard (`:2071-2088`), and uses optimistic-concurrency on the update (`.eq("order_status", currentStatus)`, per prior audit) to prevent double transitions.

**DB backstop** — `enforce_order_update_rules` trigger gates *who* may change `order_status` (seller/admin, or buyer-cancel) but **not which transitions are legal** — the transition map is the app-level guard. **Known consequence (from prior lifecycle audit):** a seller issuing a raw PostgREST update on their *own* order could skip states (e.g. `pending→delivered`); no financial/cross-tenant impact, but the DB is not a strict state-machine. Relevant to the target because a new fulfillment flow that assumes strict ordering must enforce it in the app/RPC, not rely on the trigger.

---

## 5. Inventory / payment effects of status changes

Verified against the latest RPC/trigger versions (this is stable and should be treated as load-bearing — see §11):

| Event | Inventory effect | Payment/status effect |
|---|---|---|
| Order placed (`create_order`, `20260927010000_...`) | **Decrement** `inventory.quantity` (variant-aware) + `stock_adjustments` `sale`; `products.quantity` synced by trigger | `order_status=pending`, `payment_status=pending` |
| COD collected (`mark_cod_payment_collected`) | none | inserts `payments` row, `payment_status=paid` |
| Xendit success (`process_xendit_webhook`) | none | `payment_status=paid` |
| Xendit fail/expire | **none — stock stays reserved** | `payment_status=failed`; **no auto-cancel** (TD-9, still accurate) |
| Any cancellation (`orders_restock_on_cancel`) | **Restore** stock (variant-aware) + `cancellation_restock` | `order_status=cancelled` |
| Return approved / refund (`decide_return`) | **none — does NOT restock** (see §9/§10) | `payment_status=refunded`/`partially_refunded` |
| Manual `adjust_stock` | direct +/- | none |

**Fulfillment-relevant takeaway:** stock is committed at **order placement**, not at any fulfillment step. Advancing `confirmed→processing→shipped→delivered` has **zero** inventory/payment side-effects — so adding fulfillment steps/label/tracking around those transitions is side-effect-free with respect to stock and money. Only cancellation touches inventory.

---

## 6. Multi-seller behavior

- Cart is split **by `sellerId`** into one order per seller (`groupCartBySeller.ts:12-36`). `orders` has **no `shop_id`** — everything keys off `seller_id` (TD-1). Seller↔shop is 1:1 today (DB-enforced `shop_users.unique(user_id)`), so per-seller == per-shop in practice.
- Multi-seller orders from one checkout share a `checkout_group_id` (`orders.checkout_group_id`), used for combined Xendit payment and the buyer's "N-shop order — paid together" indicator (`(account)/orders/[id]/page.tsx:143-147`).
- **Each order is fulfilled independently by its own seller.** A seller only ever sees/advances their own order (RLS `seller_id = auth.uid()`). There is no cross-seller fulfillment coupling — **each order gets its own timeline, its own contextual action, and (for the target) would get its own shipping label / tracking.** This is the correct granularity for the target flow: one label + one tracking record per seller-order, not per checkout group.
- **UNVERIFIED (live):** actual runtime isolation between two real seller sessions was not exercised; conclusion is from RLS policy text + query scoping.

---

## 7. Existing shipping, tracking, barcode, and printing capabilities

**None exist.** This is the core greenfield area for the target.

- **Shipping:** only a flat `shipping_fee_cents` and a single informational shipping method (`ShippingMethodCard.tsx`). The country is locked to Philippines; multiple comments explicitly state **"no courier/shipping API — see SAD Out of Scope"** (`checkout.constants.ts:12,20`, `ShippingAddressForm.tsx:104`, `products/[slug]/page.tsx:165`, `checkout.schema.ts:37`).
- **Tracking:** no `tracking_number`/`courier`/`carrier`/`waybill`/`tracking_url` column (§1) and no UI. `shipped_at` is the only shipment-related datum.
- **Barcode:** no barcode/QR generation for orders/labels anywhere (targeted grep for `barcode`/`waybill` → zero real hits).
- **Printing:** no `window.print`, no print stylesheet for orders, no `react-to-print` or any print dependency (grep → zero hits). `@media print` is not used for orders.
- **Delivery address for a label already exists in full:** `ShippingAddress` (`order.types.ts:10-25`) snapshots `fullName, line1, line2, barangay, city, province, region, postalCode, country, phone`, rendered by `ShippingAddressCard.tsx`. So a printable RobertJ label has **all recipient data available today** — only the label component + print path are missing.

---

## 8. Security / RLS and seller ownership

Strong and consistent (corroborated by the prior full security pass):

- **`orders` RLS** (`20260802000100_initial_schema.sql:976-1006`): SELECT/UPDATE `using (buyer_id = auth.uid() or seller_id = auth.uid() or is_admin())` with matching `WITH CHECK`. No `USING(true)`, no missing check. `order_items` derives seller scope via an `EXISTS` join to `orders` (`:1070-1094`) — no independent leak surface.
- **Defense-in-depth:** `advanceOrderStatus` re-filters by `seller_id` in the service layer (`queries.ts:2048`) on top of RLS; the action passes `null` only for admins (`order.actions.ts:125`).
- **No courier role exists**, and the target explicitly wants none — the current 3-role model (`buyer/seller/admin`) already matches. Adding fulfillment must **not** introduce a courier role.
- **Implication for the target:** any new fulfillment tables/columns (tracking, label metadata) must follow the same pattern — write through an ownership-checked RPC or an RLS policy scoped to `seller_id = auth.uid() or is_admin()`, with buyers granted **read-only** access to tracking on their own orders.
- **UNVERIFIED (live):** no live cross-tenant penetration test was run.

---

## 9. Existing redundant or conflicting functionality

- **`refunded` `order_status` is effectively dead / conflicting docs.** `ORDER_STATUS_TRANSITIONS` maps `refunded: []` and its comment (`order.constants.ts:78-79`) says "no admin refund flow exists yet" — but a refund flow **does** exist (`decide_return`); it only ever writes `payment_status`, never `orders.order_status`. So `order_status` never becomes `refunded`. Not a functional bug, but a stale comment + a vestigial enum value a new fulfillment UI should ignore (drive refund state off `payment_status`/`return_requests`, not `order_status`).
- **Dual status vocabularies** (DB enum vs. `STATUS_LABEL_MAP` vs. buyer `LifecycleTab`). Not a conflict — they are layered deliberately (DB truth → display label → buyer bucket) — but a new fulfillment feature must reuse `getOrderStatusLabel()` / `ORDER_TIMELINE_STEPS` and **not** invent a fourth naming, or the "To Pack"/"Ready for Pickup" vocabulary will drift.
- **No duplicate fulfillment controls found.** `OrderStatusControl` is the single write surface for advancement/cancel across both seller and admin detail pages (admin page composes the same component). This is good and must be preserved — the target's "avoid duplicate controls" is already satisfied; a new flow should extend `OrderStatusControl`, not add a parallel control.
- **`shipping_fee_cents` exists but is flat/informational** — not a conflict, just note the target's shipping feature is about label/tracking, not fee calculation.

---

## 10. Missing functionality relevant to proper seller fulfillment

1. **Item verification before packing** — no checklist/confirm-items affordance exists in `OrderItemsList` or `OrderStatusControl` before `confirmed→processing` ("To Pack" → "Ready for Pickup"). The transition is a single click with no per-line verification.
2. **Printable RobertJ shipping label** — no label component, no print path, no barcode. (Recipient data exists; generation + print do not.)
3. **Courier / tracking capture at "Mark as shipped"** — no fields, no form. "Mark as shipped" only flips status + stamps `shipped_at`.
4. **Buyer-facing shipment/tracking display** — buyer sees only the timeline step; no courier/tracking number/ETA section.
5. **(Related, from prior audit — out of the target's core but adjacent):** approved returns do **not** restock inventory; no seller notification when a return is filed. Flag only; not part of this fulfillment target.

---

## 11. Risks / areas that should NOT be changed

- **`create_order` RPC and its inventory lock ordering** (`inventory` FOR UPDATE before `products`) — deadlock-safe against `adjust_stock`; overselling-safe. Do not touch for a fulfillment feature (fulfillment has no inventory side-effects anyway, §5).
- **`orders_restock_on_cancel` trigger** — actor-agnostic restock. A new flow must not add a second restock path or double-restock.
- **The `order_status` enum values and `create_order`'s status defaults** — the target maps onto the existing enum; **do not rename enum values or add `to_pack`/`ready_for_pickup` enum members** (that would be a breaking schema change duplicating what `STATUS_LABEL_MAP` already provides). Keep the DB enum, extend the label/UI layer.
- **RLS on `orders`/`order_items`/`payments`** — clean; any new tracking column/table must follow the same `seller_id`/`is_admin()` pattern and grant buyers read-only.
- **Single write path (`advanceOrderStatusAction` → `advanceOrderStatus`)** — extend it; do not fork a parallel "ship with tracking" action that bypasses the transition/ownership guards.
- **Payment independence** — `payment_status` is webhook/RPC-only. A fulfillment feature must never write `payment_status`.
- **No courier role/dashboard** — keep the 3-role model.

---

## Assessment: can the current architecture support the target flow?

**Target:** `Pending → To Pack → Ready for Pickup → Shipped → Delivered`, with: progress bar = status indicator; contextual action = seller's next action; item verification before packing; printable RobertJ shipping label; courier/tracking captured at ship + shown to buyer; no courier role; no duplicate controls / unnecessary logistics.

**Verdict: Yes — the architecture is well-suited, and roughly half the target already exists.** The status backbone and both core UX concepts are built; the work is additive enrichment, not restructuring.

| Target concept | Current state | Gap |
|---|---|---|
| Progress bar = status indicator | ✅ `OrderTimeline.tsx` (Pending→…→Delivered stepper, `aria-current`, terminal handling), already using target labels | None structurally; may want the label vocabulary confirmed on the seller side too |
| Contextual action = next action | ✅ `OrderStatusControl.tsx` (single next-step button + cancel, one write path, payment-gated) | Extend to host verification + tracking capture at the right steps |
| Item verification before packing | ❌ none | **Add** a verify-items step gating `confirmed→processing` |
| Printable RobertJ shipping label | ❌ none (recipient data ✅ exists) | **Add** label component + print path (+ optional barcode of `order_number`) |
| Courier/tracking captured at ship | ❌ no data model, no form | **Add** columns/table + capture UI at `→shipped`, through the existing action/RLS pattern |
| Buyer sees shipment/tracking | ❌ timeline only | **Add** a read-only tracking section to buyer detail |
| No separate courier role | ✅ 3-role model, no courier role | Keep as-is |
| Avoid duplicate controls / heavy logistics | ✅ single `OrderStatusControl`; no courier API | Extend the one control; keep tracking as free-text/manual (no courier API — SAD scope) |

**Fit notes:**
- Fulfillment transitions have **no inventory/payment side-effects** (§5), so this is a low-risk surface to build on.
- Multi-seller granularity is already correct: **one label + one tracking record per seller-order** (§6).
- Everything can be built by **extending** the existing single write path and RLS pattern — no new role, no enum change, no parallel control.

---

## Conclusions

### What already works
- DB status backbone `pending→confirmed→processing→shipped→delivered` **and** its mapping to the target labels "To Pack"/"Ready for Pickup" (no schema change needed).
- Progress-bar stepper (`OrderTimeline`) and contextual single-action control (`OrderStatusControl`), shared cleanly between seller and admin.
- Transition enforcement in depth (map + service `seller_id` filter + optimistic concurrency + RLS).
- Full recipient/delivery-address snapshot available for a label.
- Restock-on-cancel, overselling safety, payment independence, and clean per-order seller isolation.

### What needs adjustment
- Extend `OrderStatusControl` to carry a **verification step** (before `→processing`) and a **tracking-capture step** (at `→shipped`) — without forking the write path.
- Reuse `getOrderStatusLabel()`/`ORDER_TIMELINE_STEPS` for any new labels (no fourth vocabulary).
- Fix the stale `refunded` comment / treat `order_status='refunded'` as dead when designing the UI (drive refund state off `payment_status`).
- Consider whether strict step ordering must be enforced at the RPC/DB level (§4) if the label/tracking flow assumes it.

### What needs to be added
- Item-verification affordance before packing.
- Printable RobertJ shipping label component + print path (optional barcode of `order_number`).
- Tracking/courier data model (column or small table, `seller_id`/`is_admin()`-scoped, buyer read-only) + capture UI at "Mark as shipped".
- Buyer-facing read-only shipment/tracking section on order detail.

### What should remain unchanged
- `create_order` (incl. inventory lock ordering), `orders_restock_on_cancel`, the `order_status` enum values, `orders`/`order_items`/`payments` RLS, the single `advanceOrderStatusAction` write path, payment-status independence, and the 3-role (no-courier) model.

### Recommended next step for the implementation architecture plan
Produce an **implementation architecture plan** that:
1. Confirms the label/vocabulary decision (reuse `STATUS_LABEL_MAP`; no enum change) and the per-seller-order granularity for labels/tracking.
2. Specifies the **tracking data model** (a nullable free-text `courier`/`tracking_number` on `orders`, or a dedicated `order_shipments` table) with its migration, RLS (`seller_id = auth.uid() or is_admin()` write; buyer read-only), and `database.types.ts` regeneration — following the existing chokepoint/RLS conventions and the Migration Policy in CLAUDE.md.
3. Defines how `OrderStatusControl` is **extended** (not duplicated) to host verification (gate `confirmed→processing`) and tracking capture (`processing→shipped`), keeping one write path and the transition/ownership guards.
4. Specifies the **label component** (self-contained print view + optional `order_number` barcode, no external service) and the **buyer tracking display**.
5. Decides whether to add DB-level strict-transition enforcement.
6. Lands each step lint/typecheck/build-green and updates MODULES.md / ARCHITECTURE.md (incl. the migration list, currently behind at `20260925`).

> Suggested sequencing for the plan itself: data model + RLS first (backend/data-first, per the repo's cadence), then the seller capture/verification UI on the extended control, then the label + buyer tracking display.

---

### Verification honesty
Code/enum/RLS citations are from the current files and the latest `CREATE OR REPLACE` migration versions. Live seller-vs-seller isolation and live Xendit-sandbox behavior were **UNVERIFIED** (static audit only). The absence of tracking/barcode/print capability was verified by targeted grep across `src/` and `supabase/migrations/` (only "no courier API — out of scope" comments matched).
