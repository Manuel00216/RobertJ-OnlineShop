# Xendit Payment Recovery — Implementation Plan

**Status:** Implemented 2026-09-22. All four migrations (`20260927000000`–`20260927030000`) applied to the live database; `queries.ts`, `checkout.actions.ts`, `order.types.ts`, `database.types.ts`, and the new shared `PaymentRecoveryPanel` component are updated. `lint`/`typecheck`/`build` pass. The real stuck order (`ORD-20260914-000132`) now classifies as `to_pay` live. One additional bug was found and fixed during verification, outside this plan's original stated scope — see the note at the top of `20260927030000_group_payment_retry_partial.sql` (§3c: the group webhook's per-member resolution loop wasn't channel-scoped, so it could mark a stale, never-charged payment row from an abandoned different-channel attempt as `paid`).

**Source:** Read-only audit performed in the prior session (checkout → Xendit creation/redirect → webhook → status → `/orders`). Both root causes below were confirmed against the *live* database (via `pg_get_functiondef`/`information_schema`, not just the migration files — this repo has a documented history of live/repo drift, so live state was treated as the source of truth) and against a real, currently-stuck order.

---

## 0. Recap: the two confirmed issues

| # | Issue | Live evidence |
|---|---|---|
| 1 | **Orphaned Pending orders** — `placeOrderAction`'s eager Xendit payment-attempt reservation is wrapped in a try/catch that only `console.error`s. If it throws, the order is created with `payment_status='pending'` but **zero `payments` rows**. `buyer_order_lifecycle` requires an existing `payments` row to classify an order as "To Pay," so the order silently falls into "To Ship" instead — no Pay Now button, no Cancel button (list page has no action branch for "to_ship"), stock never released. | `ORD-20260914-000132` (`checkout_group_id = 3b7930e7-066f-40f7-ab02-8e2b85858237`), `order_status='pending'`, `payment_status='pending'`, 0 payment rows, still stuck today. |
| 2 | **Group retry permanently blocked** — `begin_xendit_group_payment_attempt` loops over every order sharing a `checkout_group_id` and raises an exception if *any* member's `payment_status` isn't `'pending'`/`'failed'`. Once one seller's order in a multi-seller checkout reaches `'paid'`, retrying for the group is blocked forever — no code path pays for just the remaining unpaid order(s). | Same checkout group: `ORD-…130 = paid` (1 payment row), `ORD-…131 = failed` (2 rows), `ORD-…132 = pending` (0 rows) — retry for `132` is impossible because `130` is already paid. |

Both issues share the same underlying failure mode (stock decremented permanently at `create_order`, no auto-restock on failed/stuck payment — documented as **TD-9** — and, for grouped orders, Cancel is hidden on the list page per **TD-12**), so fixing them closes the "buyer has literally no self-service action" dead end.

**Not in scope for this plan:** TD-12's other half (allowing cancellation of a single order out of a group while others remain payable) is a related but separate change — noted under [§5 Follow-ups](#5-follow-ups-not-in-this-plan).

---

## 1. Fix design overview

### Issue 1 — make "did this order want online payment" a durable, persisted fact

Today, "this order should show a Pay Now button" is *inferred* from whether a `payments` row happens to exist. That inference breaks exactly when the thing that would have created the row fails. The fix stops inferring and starts recording:

- Add a persisted `orders.payment_method` column (`'cod' | 'xendit'`), set atomically inside `create_order`/`create_order_group` at insert time — not dependent on any later step succeeding.
- Repoint `buyer_order_lifecycle`'s "To Pay" predicate at `orders.payment_method = 'xendit'` instead of `EXISTS(payments row)`.
- Add a bounded retry (not a loop) around the eager reservation call so the common transient case self-heals immediately instead of ever needing the recovery path.
- Add the same Pay Now / Retry UI to the order **detail** page (`/orders/[id]`), which currently has none — today retry only exists on the `/orders` list card, so a buyer who navigates straight to the order detail link (e.g. from a notification) has no recovery option even for an already-correctly-classified failed payment.

This is additive everywhere: new nullable-then-backfilled column, `CREATE OR REPLACE FUNCTION` with a defaulted new parameter, one view redefinition, one new UI component placement. COD orders never touch the changed code paths differently than today (their `payment_method` is just `'cod'`, and the view's COD-relevant branches are untouched).

### Issue 2 — make group retry per-member instead of all-or-nothing

- `begin_xendit_group_payment_attempt`'s validation loop should **skip** (not reject on) members already `'paid'` or `'cancelled'`, and only require `'pending'/'failed'` for members it's about to act on.
- It should only insert new `payments` rows for the still-unpaid subset.
- `getXenditGroupPaymentTotal` must sum only that same still-unpaid subset's `total_cents` — never the whole group — so the buyer is charged exactly the right remaining amount, never double-charged for an already-paid sibling.
- `process_xendit_webhook`'s group branch already skips members with `payment_status in ('paid','failed')` (confirmed in the live function body) — **no change expected there**, but it must be re-verified once the reservation side changes, since it's the piece that reconciles the new partial charge back into per-order status.
- `finalize_xendit_group_payment_request` was **not** read in the prior audit — must be inspected during implementation to confirm it scopes its update to the freshly-inserted `'pending'` rows from *this* attempt only, not any historical `'paid'`/`'failed'` rows for the group. Flagged as a review step below, not assumed safe.

---

## 2. Affected files / functions

| Layer | File / function | Change |
|---|---|---|
| Migration (new) | `supabase/migrations/<ts>_orders_payment_method_column.sql` | Add `orders.payment_method` enum/text column + CHECK constraint + backfill for existing rows |
| Migration (new) | `supabase/migrations/<ts>_create_order_payment_method_param.sql` | `create_order` + `create_order_group`: add `p_payment_method` param (defaulted, backward-compatible), write it on insert |
| Migration (new) | `supabase/migrations/<ts>_buyer_order_lifecycle_payment_method.sql` | `buyer_order_lifecycle` view: swap the "To Pay" predicate from `EXISTS(payments)` to `payment_method = 'xendit'` |
| Migration (new) | `supabase/migrations/<ts>_group_payment_retry_partial.sql` | `begin_xendit_group_payment_attempt`: skip paid/cancelled members; `getXenditGroupPaymentTotal`'s backing query/RPC: sum only unpaid members |
| Migration (review only, no change expected) | `finalize_xendit_group_payment_request`, `process_xendit_webhook` (group branch) | Re-verify scoping still holds under a partial-group attempt |
| Service layer | `src/lib/supabase/queries.ts` — `createOrder`, `createOrderGroup`, `getXenditGroupPaymentTotal` | Thread `paymentMethod` through; update the total query if its shape needs to change |
| Server Action | `src/features/checkout/actions/checkout.actions.ts` — `placeOrderAction` | Pass `parsed.data.paymentMethod` into `createOrder`/`createOrderGroup`; add a bounded retry (e.g. 1 retry after a short delay) around the eager reservation calls (`:106-113`, `:163-169`) |
| Types | `src/lib/supabase/database.types.ts`, `src/features/orders/types/order.types.ts` | Regenerate types; add `paymentMethod` to the `Order` domain model + its mapper in `queries.ts` |
| UI (new) | `src/app/(account)/orders/[id]/page.tsx` | Render `PaymentFailedRetry` / `XenditCardPaymentButton` when `order.paymentStatus IN ('pending','failed') && order.paymentMethod === 'xendit'`, mirroring `OrderCardActions.tsx`'s existing branch |
| UI (reference, no logic change expected) | `src/features/orders/components/OrderCardActions.tsx` | Already handles a null `activePaymentChannel` by falling back to GCASH — re-verify this still matches the (now-more-common, since orphaned orders will reach this branch) null-channel case |

---

## 3. Exact implementation steps

### Step A — `orders.payment_method` column (Issue 1, foundation)

1. New migration: add `payment_method` as a Postgres enum reusing the existing naming convention (e.g. `order_payment_method` type with values `'cod'`, `'xendit'`) or a `text` column + `CHECK (payment_method IN ('cod','xendit'))` — match whichever pattern the codebase already uses for similar small enums (check `payment_method_type` on `payments` for precedent before deciding enum vs. text+CHECK).
2. Column is nullable initially (existing rows have no value yet).
3. Backfill existing rows in the same migration, using the same reliable signal identified in the audit:
   ```sql
   update public.orders
   set payment_method = case
     when checkout_group_id is not null
       or exists (select 1 from public.payments p where p.order_id = orders.id and p.payment_method_type = 'xendit')
       then 'xendit'
     else 'cod'
   end
   where payment_method is null;
   ```
4. Once backfilled, `ALTER TABLE ... ALTER COLUMN payment_method SET NOT NULL` in the same migration (safe — no more nulls after step 3).
5. This one migration alone already fixes the *misclassification* of the live stuck example (`ORD-20260914-000132`) once combined with Step C's view change — its `checkout_group_id` is non-null, so backfill correctly infers `'xendit'`.

### Step B — `create_order` / `create_order_group` accept and store `p_payment_method`

1. `CREATE OR REPLACE FUNCTION public.create_order(..., p_payment_method text default 'cod')` — defaulted so any existing/unknown caller doesn't break; validate against the same allowed set as the column's CHECK constraint (reject anything else with a clear error, mirroring how `p_channel_code` is validated elsewhere).
2. Same for `create_order_group`.
3. Both write `payment_method` into the `orders` insert alongside the existing columns — same statement, no second write, no new failure point.
4. No change to either function's existing stock-decrement / `order_items` / `stock_adjustments` logic.

### Step C — `buyer_order_lifecycle` view

1. `CREATE OR REPLACE VIEW public.buyer_order_lifecycle ...` — change:
   ```sql
   when o.payment_status in ('pending', 'failed')
     and exists (
       select 1 from public.payments p
       where p.order_id = o.id and p.payment_method_type = 'xendit'
     )
     then 'to_pay'
   ```
   to:
   ```sql
   when o.payment_status in ('pending', 'failed')
     and o.payment_method = 'xendit'
     then 'to_pay'
   ```
2. `active_payment_channel`'s subquery is unaffected (still reads the latest `payments` row for the order — for an orphaned order it correctly returns `null`, and `OrderCardActions.tsx`'s existing null-fallback-to-GCASH already handles that).
3. Re-run the view's own header comment update (precedence list) to reflect the new predicate.

### Step D — `placeOrderAction`: pass payment method + bounded retry

1. Update the two `queries.createOrder(...)`/`queries.createOrderGroup(...)` call sites to pass `paymentMethod: parsed.data.paymentMethod`.
2. Wrap the existing eager-reservation try/catch with one retry:
   ```ts
   async function reserveXenditAttemptWithRetry(fn: () => Promise<unknown>) {
     try {
       await fn();
     } catch (firstError) {
       console.error("Eager Xendit reservation failed, retrying once:", firstError);
       try {
         await fn();
       } catch (secondError) {
         console.error("Eager Xendit reservation retry also failed:", secondError);
       }
     }
   }
   ```
   Applied to both the single-order and group call sites. Still best-effort/non-blocking — order creation must never fail because of this — but now backstopped by Step C so a persistent failure no longer hides the order from recovery.
3. No change to rate limiting — this retry is bounded (max 2 attempts) and server-side only, not user-triggerable in a loop.

### Step E — order detail page gets Pay Now / Retry too

1. In `src/app/(account)/orders/[id]/page.tsx`, alongside the existing `CancelOrderButton`/`BuyAgainButton` row, add: when `order.paymentStatus in ('pending','failed') && order.paymentMethod === 'xendit'`, render the same channel-aware block `OrderCardActions.tsx` renders (`XenditCardPaymentButton` for `'CARD'`, `PaymentFailedRetry` otherwise), passing `orderId` or `checkoutGroupId` exactly as that component already does.
2. Consider extracting this small channel-branch block into a shared component (e.g. `PaymentRecoveryPanel`) used by both `OrderCardActions` and the detail page, rather than duplicating the branch — evaluate at implementation time against "avoid unnecessary abstraction" (CLAUDE.md); two call sites with identical logic is the threshold where extraction usually pays for itself.

### Step F — Group retry: skip paid/cancelled members (Issue 2)

1. `CREATE OR REPLACE FUNCTION public.begin_xendit_group_payment_attempt(...)`:
   - Change the per-member validation loop from *raise on any non-pending/failed member* to: skip (continue) any member that's `'paid'` or the order is `'cancelled'`; only raise if a member is in some other unexpected state. Track which order ids are still eligible.
   - If zero members are eligible (whole group already resolved), raise a clear "This group has already been paid" error — matches today's behavior for the fully-paid case, just reached via a different path.
   - The existing "reuse a still-valid in-flight attempt" check stays scoped to the eligible subset.
   - The `insert into payments (...) select ... from orders where checkout_group_id = ... ` becomes `... where checkout_group_id = ... and id = any(v_eligible_order_ids)` (or equivalent `NOT IN (already-paid ids)` filter).
2. `getXenditGroupPaymentTotal` (`queries.ts`, backed by whatever RPC/query it currently uses — re-check its exact current implementation, not fully traced in the prior audit) must sum `total_cents` only over the same eligible subset. If it currently sums unconditionally over the whole `checkout_group_id`, this is a required, not optional, change — an unfixed total here would either overcharge (double-billing a paid member) or undercharge (if computed some other stale way).
3. Re-verify `finalize_xendit_group_payment_request` (not read in the prior audit) only ever touches rows it just inserted this attempt (`status = 'pending' and xendit_payment_request_id is null`, or similar) — confirm it can never reach back and mutate an already-`'paid'` sibling's row. Adjust only if it currently scopes too broadly.
4. `process_xendit_webhook`'s group branch: re-confirm (already read once, appears correct) that its `for v_member in ... loop` + `if v_member.payment_status in ('paid','failed') then continue` still correctly leaves resolved members untouched when the next webhook arrives for a fresh partial-group charge. No change expected; verify, don't assume.

---

## 4. Stock / cancellation behavior (explicitly unchanged by this plan)

- `create_order`/`create_order_group`'s stock-decrement logic is **not touched** by either fix — stock is still decremented at placement, for COD and Xendit alike, exactly as today (TD-9 stays open, by design — out of scope here).
- The only restock path remains order cancellation (`orders_restock_on_cancel` trigger) — unchanged.
- Once Step C lands, a previously-orphaned order becomes visible in "To Pay" — meaning the buyer can now *either* retry payment (new) *or* rely on the existing (list-hidden-for-groups, but detail-page-reachable) Cancel button to restock if they no longer want it. This plan does not change Cancel's group-visibility inconsistency noted in the audit (list hides it per TD-12, detail page doesn't check group membership) — flagged as a follow-up, not fixed here, so as not to silently change TD-12's documented behavior without a separate decision.
- Issue 2's fix means a partially-paid group's still-unpaid member can now be retried *or* cancelled independently — cancelling it still only restocks that one order's items, unaffected by its paid siblings, same as today's single-order cancel behavior.

---

## 5. Follow-ups (not in this plan)

- **TD-12, cancel side:** allowing a buyer to cancel a single order out of a multi-seller group while others remain "To Pay" safely (i.e. without the group-payment RPC choking on a cancelled member) is the natural next piece, since Step F's "skip ineligible members" logic is most of what that fix would also need. Worth doing as a fast-follow once Step F is verified, not bundled in to keep this change reviewable.
- **Data repair for already-orphaned live orders:** `ORD-20260914-000132` and any other pre-existing zero-payment-row "pending" orders will self-heal in classification the moment Step A's backfill + Step C's view change land (no separate repair script needed) — confirm this explicitly in testing (see checklist item 8 below) rather than assuming.
- **Detail-page Cancel button vs. TD-12:** decide deliberately (separate discussion) whether the detail page's `order.cancellable` check should also respect group membership, to make list and detail page consistent either way.

---

## 6. Security considerations

- **New RPC parameter (`p_payment_method`):** never trust it beyond the same allowed-values validation already used elsewhere in these functions (e.g. `p_channel_code not in (...)` pattern) — reject anything outside `('cod','xendit')` with a clear error, and the column-level `CHECK` constraint is the second, unconditional layer of defense (defense in depth, same pattern as every other enum-ish column in this schema).
- **Charge amount for a partial group retry:** must continue to be computed **entirely server-side** from `orders.total_cents` over the eligible-member subset — never accept or infer an amount from the client. This is a strengthening of an existing invariant, not a new one; the risk is a computation *bug* (wrong subset summed), not a new trust boundary.
- **`buyer_order_lifecycle` is `security_invoker = true`:** the predicate change doesn't alter what data the view exposes (payment_method is no more sensitive than the payments-row-existence signal it replaces) or who can query it (`grant select ... to authenticated` unchanged) — no RLS/grant changes needed.
- **Idempotency:** the added retry in `placeOrderAction` (Step D) must not create a second `payments` row — it doesn't, because it calls the exact same `beginXenditPaymentAttempt`/`beginXenditGroupPaymentAttempt` RPCs, which already have their own idempotent "reuse a still-valid pending attempt" check; the retry is safe by construction, not because of new logic.
- **Webhook trust boundary is unchanged:** `process_xendit_webhook` remains the sole path to `'paid'`; nothing in this plan lets the frontend, `placeOrderAction`, or the retry path mark anything paid.
- **No new client-writable surface:** `payment_method` is set once, server-side, at order creation, from a value already validated by `checkoutSchema` (zod) — never subsequently writable by the buyer (not part of `enforce_order_update_rules`'s buyer-writable field set, and shouldn't be added to it).

---

## 7. Test / verification checklist

Per this project's established methodology (no browser automation available in this environment; the accepted approach — used successfully in the prior variant-selector audit — is rolled-back SQL transactions for data/RPC-level verification, and temporary *committed* test data only with explicit user sign-off, cleaned up immediately after, for UI-rendering checks via the dev server).

**Static checks (always required, per CLAUDE.md):**
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`

**RPC/data-layer verification (rolled-back transactions — no live writes):**
- [ ] `create_order`/`create_order_group` with `p_payment_method='cod'` (and the old call shape, relying on the default) still produces identical `orders` rows to today, modulo the new column.
- [ ] `create_order`/`create_order_group` with `p_payment_method='xendit'` stores it correctly.
- [ ] Invalid `p_payment_method` value is rejected with a clear error (both the RPC-level validation and the CHECK constraint, tested independently).
- [ ] `buyer_order_lifecycle`: a `payment_method='xendit'`, `payment_status='pending'`, **zero payments rows** order now classifies as `to_pay` (this is the exact shape of the live stuck order).
- [ ] `buyer_order_lifecycle`: a `payment_method='cod'` order's classification is unchanged from today (regression check).
- [ ] `begin_xendit_group_payment_attempt` on a group with one `'paid'` + one `'pending'` member: no longer raises; returns/creates an attempt scoped to only the pending member.
- [ ] `begin_xendit_group_payment_attempt` on a group where *every* member is already `'paid'`: still raises a clear "already paid" error (no regression to a silent no-op).
- [ ] `getXenditGroupPaymentTotal` on a partially-paid group returns the sum of only the unpaid members' `total_cents` — not the full group total.
- [ ] `finalize_xendit_group_payment_request` after a partial-group attempt only updates the freshly-reserved rows — a previously-`paid`/`failed` sibling's row is byte-for-byte unchanged (`pg_get_functiondef` diff before/after is not the check here — an actual row-level before/after comparison inside the rolled-back transaction is).
- [ ] `process_xendit_webhook` (group branch) against a partial-group charge: correctly resolves only the newly-charged member(s), leaves the already-`paid` sibling's row untouched, and produces the expected `payment_webhook_events` audit rows.

**Backfill migration (rolled-back transaction against a copy of relevant rows, or dry-run `SELECT` of the backfill's `CASE` logic before running the real `UPDATE`):**
- [ ] Dry-run the backfill `SELECT` against current live data and manually spot-check a sample of results (including `ORD-20260914-000132` specifically) before the real migration runs.
- [ ] After migration (live), confirm every pre-existing `orders` row has a non-null `payment_method`, and spot-check that the inferred value matches reality for a sample of both COD and Xendit orders.

**UI verification (temporary committed test data, only with explicit sign-off, deleted immediately after — same pattern used for the variant-selector audit):**
- [ ] Simulate an orphaned order (payment_method='xendit', payment_status='pending', no payments row) → confirm it appears under the "To Pay" tab on `/orders` and shows the Pay Now button with the GCash fallback channel.
- [ ] Click-equivalent: invoke `createXenditEwalletPaymentAction`/`createXenditCardSessionAction` against that orphaned order → confirm it successfully creates the missing `payments` row and proceeds normally from there on.
- [ ] Confirm the same order also shows a working Pay Now button on the order **detail** page (new coverage from Step E).
- [ ] Confirm a normal COD order's list/detail rendering is pixel-for-pixel unchanged (regression check).
- [ ] Confirm a normal single-seller failed-Xendit order's existing retry flow is unchanged (regression check).

**Live data closure:**
- [ ] After all migrations are applied, re-query `ORD-20260914-000132` directly — confirm it now classifies as `to_pay` and that a real (not test) Pay Now attempt against it succeeds in creating a payments row. This is the acid test: the fix should resolve the exact real order the audit found, not just synthetic cases.

**Rollback plan:**
- [ ] Each migration's header comment documents its own rollback (`DROP COLUMN` / restore-previous-function-body pattern, matching every existing migration in this repo).
- [ ] Confirm `payment_method` being dropped doesn't orphan anything else added in a later step (check migration ordering before implementation day).
