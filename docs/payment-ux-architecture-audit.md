# Payment UX Architecture — Read-Only Audit

**Status:** Audit only. No code, database, migration, config, or payment records were modified.
**Scope:** Card / GCash / Maya lifecycle across checkout, orders, webhook, reconciliation, and cleanup.

---

## 1. Current behavior (end-to-end)

```
Cart → Checkout (CheckoutForm) → Place Order (placeOrderAction, one create_order/create_order_group call)
     → COD: land on /orders
     → GCash/Maya: immediately call createXenditEwalletPaymentAction → redirect to Xendit hosted checkout
     → Card: render XenditCardPaymentButton inline on the checkout page (autoStart) → Components widget
     → Xendit webhook (server-to-server, sole writer of `paid`) → orders.payment_status synced in the same transaction
```

Cart items are removed **immediately after order creation succeeds**, before any payment outcome is known (`CheckoutForm.tsx:299-305`). So by the time payment fails, the cart is already empty — this is why `BuyAgainButton` (re-adds order lines to cart) exists as today's only "start over" path.

The most recent commit (`121abe3`, "Complete Card payment during checkout instead of a second Orders step") already moved Card payment *into* the checkout flow instead of a later Orders click — so the desired `Checkout → Complete payment → Orders` shape is **already implemented for the happy path**. What's left un-migrated is the **failure/recovery** path, which still lives entirely in Orders:

- `src/features/orders/components/OrderCardActions.tsx:36-86` — renders `PaymentRecoveryPanel` for any order in the `to_pay` lifecycle tab.
- `src/app/(account)/orders/[id]/page.tsx:142-163` — renders the same `PaymentRecoveryPanel` on the detail page.
- `PaymentRecoveryPanel` → `PaymentFailedRetry` (GCash/Maya "Pay Now") or `XenditCardPaymentButton` ("Pay with Card"), both **buyer-facing payment-initiation CTAs living in Orders** — exactly what the new requirement forbids.

**Orders never chooses the channel** — `PaymentRecoveryPanel` is hard-locked to `order.activePaymentChannel` (falls back to `"GCASH"` if null). There is **no "change payment method" UI anywhere in the app today.**

### Payment-safety mechanisms already in place (all backend, framework-agnostic to where the UI lives — verified, not assumed)

| Mechanism | File | What it does |
|---|---|---|
| Sole payment authority | `src/app/api/webhooks/xendit/route.ts` | Only `process_xendit_webhook`/`process_xendit_refund_webhook` (service-role RPCs) ever set `paid`. Client redirects are informational only. |
| In-window attempt reuse | `begin_xendit_payment_attempt` / `begin_xendit_group_payment_attempt` (`20260927040000_xendit_stale_pending_dedup.sql:63-157`) | A retry within the attempt's freshness window (2 min pre-Xendit / 20 min GCash-Maya / 30 min Card) **returns the same `checkoutUrl`** instead of creating a new charge. |
| Stale-attempt reconciliation | `src/features/payments/lib/xendit-reconciliation.ts` | Before treating an attempt as abandoned (new retry *or* cancellation), asks Xendit for ground truth and applies it via the same webhook RPC. Returns `already_paid` / `cleared_for_retry` / `blocked`. |
| Synchronous reconcile-before-retry | `xendit.actions.ts` (all 4 `createXendit*Action`s) | A stale existing attempt is reconciled before a new one is allowed. |
| Synchronous reconcile-before-cancel | `order.actions.ts:38-61` (`blockCancellationIfXenditUnresolved`) | Cancellation is blocked while Xendit's real status is unconfirmed. |
| Passive nightly sweep | `src/app/api/cron/xendit-reconciliation/route.ts` + `vercel.json` (`0 3 * * *`) | Catches attempts nobody ever returns to retry/cancel. Only covers rows that actually reached Xendit (`xendit_payment_request_id is not null`). |
| Superseding orphaned rows | same migration as above | Caps accumulation at one live `pending` row per (order/group, channel) so repeated retries can't pile up duplicate rows. |
| Group partial-retry | `20260927030000_group_payment_retry_partial.sql` | A multi-seller group retry only touches still-unpaid members; an already-paid sibling's row is provably untouched. |
| Cancellation guard | `enforce_order_update_rules` (`20260925000000_guard_order_cancellation_attribution.sql:38-68`) | DB-level trigger blocks cancelling an order with a still-fresh in-flight online payment, independent of the app-layer check above (defense in depth). |

This is a materially more sophisticated safety net than the audit request's wording implies is currently missing — **the duplicate-charge and reconciliation problem is already solved well**. The actual gap is architectural placement (Orders vs. Checkout) plus two real functional gaps (channel-switching, and abandoned-order expiry), covered below.

---

## 2 & 3. Problems found / per-scenario behavior

| # | Scenario | Current behavior | Verdict |
|---|---|---|---|
| 1 | **Failed/cancelled** (definitive) | Webhook or reconciliation sets `payments.status='failed'` + `orders.payment_status='failed'` in one transaction. Order stays in `to_pay` tab. Retry CTA lives in **Orders** (`OrderCardActions`/detail page). | Works, wrong location. |
| 2 | **Session expired** | Card: client sees `session-expired-or-canceled`, purely a UI phase (`XenditCardPaymentButton.tsx:93-95`) — DB untouched until webhook/reconciliation. GCash/Maya: `expires_at` (Card real value) or a 20/30-min heuristic window (`isStaleXenditAttempt`) governs when a retry reconciles instead of reusing the URL. | Works, wrong location. |
| 3 | **Browser closed mid-payment** | No client-side signal exists or is needed — webhook is server-to-server, independent of the browser. Next buyer action (revisit Orders, click Pay Now, or the nightly cron) reconciles. | **Handled correctly today.** Gap: nothing *proactively* tells the buyer; they must come back on their own. |
| 4 | **Internet lost mid-payment** | Same as #3 — webhook doesn't depend on the buyer's connection. | **Handled correctly today.** |
| 5 | **Succeeds at Xendit, browser never gets the response** | Webhook still lands independently; `paid` is set regardless of what the browser saw. Client-side `session-complete`/return-URL handling is cosmetic only. | **Handled correctly today** — this is the scenario the architecture is explicitly built to survive. |
| 6 | **Succeeds but webhook delayed** | `orders.payment_status` stays `'pending'`. Orders currently shows "Payment Pending" + a still-clickable **Pay Now** button. Clicking it: if the existing attempt is still within its freshness window, `beginXenditPaymentAttempt` returns the *same* row and the action redirects to the *same* Xendit URL — **no duplicate charge**. If it's gone stale before the webhook lands, the synchronous reconcile-before-retry runs Xendit's real status first; if Xendit says `SUCCEEDED`, the retry is blocked and the buyer is redirected to the (already-paid) order instead. | **Duplicate-charge-safe today**, by construction, not by luck. Must be preserved exactly. |
| 7 | **Pending/unknown indefinitely** | Nightly cron (`0 3 * * *`) reconciles only rows that reached Xendit (`xendit_payment_request_id is not null`). Rows that never got that far (reservation succeeded, then the buyer bailed before Xendit was ever called) are invisible to the sweep — they just sit as `to_pay` with a manual Pay Now fallback. | **No forced-retry risk** (nothing ever auto-fires a new charge), but **no auto-resolution either** for the "never reached Xendit" subset. |
| 8 | **Change GCash→Maya→Card after definitive failure** | **Not supported on the same order at all.** `PaymentRecoveryPanel` is hard-locked to one channel. The only route is: cancel the order (allowed once the attempt is reconciled to `failed`) → `BuyAgainButton` re-adds items to cart → checkout again with a different method → a **new `orders` row is created** (new order number; old one stays as a cancelled record). | Functionally safe (old order never double-charged) but **does create a second order row** — the thing the requirement says to avoid "unnecessarily." |
| 9 | **Online-payment order placed, payment never started** | Order exists with `payment_method='xendit'`, `payment_status='pending'`. Sits in `to_pay` forever with no nudge, no expiry. Recovery is 100% buyer-initiated (must return to Orders and click Pay Now). | No forced action, but no cleanup either. |
| 10 | **Cart cleared before payment completes** | Confirmed: `removeMany(checkoutItems)` runs immediately after order creation succeeds (`CheckoutForm.tsx:299-305`), *before* the GCash/Maya redirect or the Card widget even starts. So the cart is already gone the moment payment could fail — by design, not a bug. `BuyAgainButton` is the only path back to a cart-like state, and only appears on `completed`/`cancelled` tabs (never `to_pay`). | Expected/by-design; matters for the recovery-flow design below. |

**Confirmed gap (not new — already tracked as TD-9 in `ARCHITECTURE.md`'s Technical Debt Register per the prior Xendit-recovery work):** there is **no automatic expiry/cancellation of abandoned unpaid orders**, and stock decremented at `create_order` is **never auto-released** except via the buyer's own manual Cancel. An order can sit `pending`/`to_pay` indefinitely, holding stock, with zero forcing function. This is the one real hole in "abandoned checkout eventually expires safely."

**Secondary finding, not payment-flow-critical:** `src/features/payments/components/XenditPaymentOptions.tsx` is exported from the feature barrel (`payments/index.ts:23`) but is not rendered anywhere under `src/app` — appears to be dead code left over from before Card payment moved into checkout. Worth removing in the same change, not because it affects buyers, but because it's exactly the kind of stale payment-initiation surface this cleanup is trying to eliminate.

---

## 4. Recommended best-practice payment flow

Keep the already-correct happy path exactly as-is:
```
Cart → Checkout → Select payment method → Place Order → Complete payment (inline, on Checkout) → Orders
```

Add a **Checkout-owned recovery surface** for the failure/pending/abandoned cases — not a new order-creation flow, a *resume* flow against the order(s) that already exist:

```
Orders (informational, status only)
   │  "Payment needed" badge/status, NO action button
   ▼
Checkout resume view (new route, e.g. /checkout/resume/[orderId] or /checkout/resume?group=)
   │  Hosts exactly the logic PaymentRecoveryPanel/XenditCardPaymentButton have today —
   │  moved, not rewritten. Reuses the SAME order — never calls create_order again.
   ├─ definitive failure → Retry same channel, or Change Payment Method (new capability)
   ├─ pending/unresolved  → "Confirming with [provider]…" — reconcile first, no retry button shown
   │                        until reconciliation resolves it one way or the other
   └─ already paid         → redirect straight to Orders (nothing to resume)
```

This satisfies the "must never start/retry/resume/change payment from Orders" rule literally: Orders stops importing anything from `src/features/payments`. The only thing Orders may do is **link** (plain navigation, not a payment action) to the Checkout resume surface — see the open question in §10.

---

## 5. How failed payments should return to Checkout

- Definitive failure (`payment_status = 'failed'`, confirmed via webhook or reconciliation) → the resume view under Checkout shows the failure reason (already captured in `payments.failure_reason`, already surfaced in `PaymentStatusBadge`/order detail today) plus **Retry** (same channel) and **Change Payment Method** (new).
- Both actions operate on the **existing order** — `beginXenditPaymentAttempt`/`beginXenditGroupPaymentAttempt` already accept an arbitrary channel per call; today's UI just never offers the choice. No `create_order` call is needed to switch channels.
- The GCash/Maya/Card `returnUrl`s currently point back to `/orders/[id]?xendit_return=1` or `/orders?xendit_return=1` (`xendit.actions.ts:75,173,258,356`) — these need to become Checkout-resume URLs instead, so a buyer bounced back from Xendit's hosted page lands in Checkout, not Orders. This is a real, in-scope code change once implementation starts.

---

## 6. How buyers can safely change payment methods

1. Only offered once the current attempt is **definitively resolved** (`failed`) or was never started — never while `pending`/unresolved. Reuse the exact same "resolve before offering an action" pattern already proven for cancellation (`blockCancellationIfXenditUnresolved`) and retry (`isStaleXenditAttempt`/`reconcileStaleXenditAttempt`).
2. Selecting a new channel calls `beginXenditPaymentAttempt`/`beginXenditGroupPaymentAttempt` with the new channel — this is already channel-parameterized server-side; only the UI needs to expose the choice.
3. **No `create_order` is invoked.** Same order id, same order number, same stock hold — a channel switch is not an order re-creation. This is the change that actually satisfies "without unnecessarily creating duplicate orders," replacing today's only workaround (cancel → Buy Again → new order).
4. Guard needed (does not exist today because no UI exercises this path): before starting attempt on channel B, if channel A already has a still-fresh (non-stale) `pending` row, block — same reasoning as the existing "second Card session while one is in flight" 409 guard in `createXenditCardSessionAction`, generalized across channels.

---

## 7. How duplicate charges are prevented (today, and after this change)

Already proven, and unaffected by relocating the UI:
- In-window retry reuses the same `checkoutUrl`/attempt row rather than creating a new one.
- Stale attempts are reconciled against Xendit's real status *before* a new attempt is allowed — if Xendit says paid, the retry is blocked, not doubled.
- The webhook (never the client, never a Server Action) is the only writer of `paid`.
- Channel-switching (new capability) reuses `payments.order_id` + `payment_channel` as the natural uniqueness axis — a different channel is a different `payments` row by construction, but the **order** stays one row, and the guard in §6.4 prevents two channels being simultaneously in-flight.

Nothing about moving the UI from Orders to Checkout changes any of this — it's a pure relocation of *where the button lives*, not a change to *what happens when it's clicked*.

---

## 8. How abandoned/unpaid checkout should be handled

This is the one piece that needs new backend work, not just UI relocation, to fully satisfy "eventually expire safely and clean up temporary reservations":

- Extend the existing nightly cron (or add a second, separate scheduled job — smallest-footprint choice TBD at implementation time) to also catch orders that are `payment_method='xendit'`, `payment_status` in `('pending','failed')`, and past a defined abandonment threshold (proposal: 24–48h, configurable — needs a business decision, not an engineering guess) **regardless of whether a `payments` row with a `xendit_payment_request_id` exists** (today's sweep only looks at rows that reached Xendit).
- Auto-cancel such orders through the *same* `cancel_buyer_order`-equivalent path (or a new `cancelled_by = 'system'` variant) so the existing `orders_restock_on_cancel` trigger fires and stock is released — reusing the restock mechanism that already exists for buyer-initiated cancellation, not inventing a second one.
- Must NOT fire while a payment is still genuinely resolvable (i.e., still respect `isStaleXenditAttempt`'s freshness window / do a final reconcile-with-Xendit pass before cancelling, exactly like the pre-cancellation guard already does for buyer-initiated cancels) — an auto-expiry must never cancel an order that Xendit still considers payable.
- This is new scope beyond "move the UI" — flagging it explicitly rather than folding it silently into the UI relocation, per "do not assume every unpaid order should simply move back to Cart" and per CLAUDE.md's rule to surface anything resembling a business-rule decision before implementing.

---

## 9. Exactly which Orders payment actions should be removed

| Component | File | Action |
|---|---|---|
| `OrderCardActions` `to_pay` branch | `src/features/orders/components/OrderCardActions.tsx:36-86` | Remove the `PaymentRecoveryPanel` render entirely. Replace with a status-only element (e.g. "Payment needed" + a plain navigation link to the Checkout resume view). `CancelOrderButton` stays — cancelling isn't initiating a payment. |
| Order detail page payment recovery block | `src/app/(account)/orders/[id]/page.tsx:142-163` | Remove the `PaymentRecoveryPanel` render (`showPaymentRecovery` block). `PaymentStatusBadge` + failure reason display (lines 186-207) stay — that's exactly the "informational" surface the requirement wants kept. |
| `PaymentRecoveryPanel`, `PaymentFailedRetry`, `XenditCardPaymentButton` (non-checkout usages) | `src/features/payments/components/*` | Not deleted — `XenditCardPaymentButton` is still needed inline in `CheckoutForm` (already used there) and would be reused by the new Checkout-resume view. `PaymentRecoveryPanel`/`PaymentFailedRetry` move to being imported only by the new Checkout-resume route, never by `src/features/orders/*`. |
| `XenditPaymentOptions.tsx` | `src/features/payments/components/XenditPaymentOptions.tsx` | Confirmed unused anywhere under `src/app`. Recommend deleting as part of this cleanup (dead payment-initiation surface), pending confirmation it's not intentionally held in reserve for something. |
| Return URLs | `xendit.actions.ts` (4 call sites) | Point at the new Checkout-resume route instead of `/orders`/`/orders/[id]`. |

Nothing else in Orders touches payment initiation today — `MarkCodCollectedButton`, `PaymentsList`, `PaymentStatusFilter` are seller/admin-side (dashboard), out of scope for this buyer-facing rule.

---

## 10. Smallest safe implementation approach

Ordered by dependency, each step independently shippable and buildable/typecheckable:

1. **New Checkout-resume route** (e.g. `src/app/checkout/resume/[orderId]/page.tsx` + a group variant) that renders `PaymentRecoveryPanel`/`XenditCardPaymentButton` exactly as today, just relocated. Zero backend change.
2. **Point the 4 Xendit action return URLs** at the new route instead of `/orders`.
3. **Strip the payment CTAs from Orders** (both files in §9), replacing with a status-only element + a plain link to the new route.
4. **Add channel-switching** to the resume view: a small picker (reusing `PaymentMethodCard`'s channel list) gated on "current attempt is resolved/failed," calling the existing `beginXendit*Attempt` RPCs with the chosen channel — no `create_order` involved. Add the cross-channel in-flight guard from §6.4.
5. **Abandoned-order expiry** (§8) — separate PR, needs a business decision on the threshold before implementation, and is genuinely new scope (a new cron path + a system-cancel variant of the existing cancel RPC), not a UI move.
6. **Delete `XenditPaymentOptions.tsx`** if confirmed unused (quick, independent, low-risk cleanup).

Steps 1–3 alone already satisfy the hard requirement ("no payment CTAs in Orders, ever") using only relocation — no new payment logic, no new duplicate-charge surface, nothing to re-verify against the safety net in §7. Steps 4–6 are the "don't just delete the fallback, design the real replacement" pieces the request explicitly asked for, and can follow once 1–3 are verified live.

---

## Open questions before implementation (not decidable from the code alone)

1. **Is a plain navigational link from Orders → Checkout-resume acceptable**, or should Orders not even link there (i.e., must the buyer independently discover the pending order in Checkout / a dedicated "Resume" entry point)? The strictest reading of "no buyer-facing payment CTA" could exclude even a status-only link. Recommend: a link is fine (it doesn't initiate payment, just navigates), but confirm before building.
2. **Abandonment threshold** for auto-cancel (§8) — this is a business rule (stock hold duration, buyer grace period), not something to infer from code.
3. **Should `XenditPaymentOptions.tsx` be deleted** or is it intentionally kept for a near-term use not yet wired up?

No implementation has been done. This report is the full read-only audit requested; awaiting confirmation on the above before any code, migration, or UI change.
