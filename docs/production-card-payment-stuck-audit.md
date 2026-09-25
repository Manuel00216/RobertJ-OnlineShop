# Production Card Payment Stuck-in-To-Pay — Read-Only Audit

**Status:** Audit only. No code, DB, config, or deployment was modified. All evidence below was pulled from the live Supabase project (`hjxtbnmnwlbqgptgncoh`), live Vercel request logs for `roberj-onlineshop.vercel.app`, and the live `process_xendit_webhook` function body (`pg_get_functiondef`, not the migration file — this repo has documented live/repo drift history).

**Date of tests:** 2026-09-22, all times UTC. Deploy of the Checkout-architecture change (`e01ef0c`) landed at 13:11:10 UTC; every test below ran against that same deployment.

---

## 1. Confirmed root cause

**The Xendit webhook for the stuck group's Card session was delivered and accepted (HTTP 200), but never reached `process_xendit_webhook` at all.** The webhook route's own payload-shape guard (`src/app/api/webhooks/xendit/route.ts`) rejected it before calling the RPC — the same unresolved class of bug already called out in that file's own comments from a prior session ("this exact gap is why a real, successfully-completed Card payment ... went unreconciled for hours before being found and fixed manually").

This is **not** caused by the new Checkout-only payment architecture, the in-flight/channel-switch guard, `create_order`, or any DB trigger. It is a pre-existing gap in how the webhook route recognizes different Card-session webhook payload shapes — Xendit is evidently sending at least two structurally different payloads for "Card session done" events, and the route only reliably parses some of them.

**Confidence:** High on "webhook route rejected it before the RPC ran" (proven by DB absence + log presence, see below). Lower/unconfirmed on the *exact* payload shape that caused the rejection, because the route only `console.error`s a summary for unrecognized payloads — it does not persist the raw body anywhere queryable, and that specific log line was not retrievable through the Vercel CLI's log export in this audit (see §2, Gap 3).

---

## 2. Evidence from both tests

### Test 1 — successful, single-seller Card order (`ORD-20260922-000217`, order id `9ed58998-3dea-4f51-8bd6-1c3b93f00b4d`)

| Field | Value |
|---|---|
| `checkout_group_id` | `null` (single order) |
| payments row | `7c8e0e21-e4b3-4841-8e73-a9c1adb28255` |
| `payment_channel` (final) | `CARDS` (plural — overwritten by the webhook; see below) |
| `xendit_payment_request_id` (final) | `pr-05fe3881-0675-85ae-89ea-8fec959aa509` |
| created / paid | 13:16:25.849 → 13:18:17.336 (≈112s, normal card-entry time) |
| Webhook received | **Yes** — `payment_webhook_events` row `2f52aa98…`, `event: "payment.capture"`, `data.channel_code: "CARDS"`, `data.reference_id: "7c8e0e21…_DGFFcCX6PQ"`, `processing_result: "applied"` |
| Vercel log | `13:18:17.335` `POST /api/webhooks/xendit` → `200` |

### Test 2 — stuck, 3-seller / 4-line-item Card group (checkout_group_id `5e621f77-f430-430d-b028-71d81d56d199`, orders `ORD-000221/222/223`)

| Field | Value |
|---|---|
| Orders | 3 orders, 4 order-item lines total (1+1+2) — matches "4 items/orders" |
| payments rows | 3 rows, one per order, **all `status = 'pending'`**, all sharing one session: `xendit_payment_request_id = ps-6ab2814c3589faffa4215ef9` |
| `payment_channel` | `CARD` (singular — never overwritten, because no webhook ever updated it) |
| Session created / finalized | 13:23:18.591 (eager reservation) → 13:23:24.552 (real Xendit session minted — `expires_at = 13:53:23.878`, a real Xendit-issued value, confirming the session was genuinely created at Xendit's end) |
| Webhook received (DB) | **No matching row in `payment_webhook_events`** — searched by every candidate reference (checkout_group_id, each order id, the session id) across the full test window; zero matches |
| Webhook received (Vercel log) | **Yes** — `13:24:23.50` `POST /api/webhooks/xendit` → `200`, ~59s after the session was finalized (consistent with a buyer submitting the card form) |
| `payments` rows since | **Unchanged** — `updated_at` still `13:23:24.552`, identical to finalize time; nothing has touched these rows since |
| Retry currently possible? | **No** — session isn't stale yet (`now()` at audit time `13:47:53`, `expires_at 13:53:23`); a same-channel retry click right now returns the existing "a card payment is already in progress" guard, not a new charge |

**The contradiction that proves the root cause:** a webhook POST was delivered and accepted (200) at 13:24:23, but nothing in the database — not even a defensive `unknown_reference`/`reference_mismatch`/`ignored_transient_status` audit row, which every code path inside `process_xendit_webhook` inserts unconditionally — shows any trace of it. The only way a webhook route returns 200 *without* the RPC leaving a trace is if the RPC was never called at all, which only happens in one place: the route's own `if (!referenceId || !status)` early return (`src/app/api/webhooks/xendit/route.ts:64-78`), which returns `{received: true, note: "unrecognized payload shape"}` and only `console.error`s a summary — no DB write.

### Corroborating comparison — an *earlier*, successful multi-seller Card group (checkout_group_id `48f4939b…`, pre-dates these two tests)

This group's webhook succeeded, but via a **third, different-looking payload**: `payment_webhook_events` shows `event: null`, `data.channel_code: null` — i.e. neither field was present at all, yet `reference_id`/`status` still were (since it succeeded, `processing_result: "applied"` × 3). This confirms Xendit is not sending one consistent payload shape for Card session completions — at minimum there's the `payment.capture`-shaped one (Test 1, has `channel_code`), a bare one with `event`/`channel_code` absent but `reference_id`/`status` present (this earlier group), and — inferred by elimination — a third shape for the stuck test where even `reference_id` or `status` didn't extract cleanly.

### Gaps in what read-only evidence can prove

1. **Whether Xendit actually charged the card for Test 2.** Our DB has no record either way, and I did not call Xendit's API (that would require the same `reconcileStaleXenditAttempt` path used elsewhere, which is a mutation — out of scope for a read-only audit).
2. **The exact raw payload Xendit sent at 13:24:23.** The webhook route never persists the raw body for a payload it fails to parse — only a `console.error` summary — and that specific log line was not retrievable via the Vercel CLI's log export (all entries I could pull, including this one, show an empty `logs: []` field regardless of whether `console.error` fired; this appears to be a limitation of what the CLI's log-export endpoint surfaces, not evidence the log call didn't happen).
3. Because of (2), I cannot state definitively *which* field (`reference_id` vs `status`) was missing or malformed — only that the route's existing extraction logic didn't produce both.

---

## 3. Why the second test stayed in To Pay

Because nothing ever told our database the payment resolved. `orders.payment_status` and `payments.status` only change in three ways: the live webhook, the synchronous reconcile-before-retry check, or the nightly cron sweep. The live webhook fired and was silently dropped by the route's shape guard (per §1–2). The synchronous reconcile path only runs when the buyer clicks Retry/Pay *and* the existing attempt is stale — the session isn't stale yet (expires 13:53:23 UTC), so nothing has triggered it. The nightly cron runs once at 03:00 UTC and hasn't run since this test. So the order is correctly, safely stuck showing "pending" — it simply hasn't been told otherwise yet.

## 4. Frontend / backend / DB / Xendit / webhook?

**Webhook-route-level (backend), pre-existing, not introduced by this session's Checkout-architecture change.** Specifically `src/app/api/webhooks/xendit/route.ts`'s payload-shape recognition (the `referenceId`/`status` extraction ahead of calling `process_xendit_webhook`). Not:
- **Frontend** — `XenditCardPaymentButton`/`CheckoutResumePanel` behaved correctly; the session was created successfully server-side with a real Xendit-issued `expires_at`, meaning the widget did mount.
- **DB / RPC logic** — `process_xendit_webhook`'s group branch, channel-scoping, and audit-logging are all working as designed (proven by the *other* successful group test, `48f4939b`, using a similarly sparse payload). It was never given the chance to run for this specific delivery.
- **The new Checkout-only flow or its in-flight/channel-switch guard** — confirmed uninvolved. I did not touch the webhook route or `process_xendit_webhook` in the Checkout-architecture change, and the guard I added only ever gates *starting a different channel*, which was never attempted here (the resume page correctly keeps `canChangeChannel = false` while `paymentStatus = 'pending'` with an existing attempt — only same-channel Retry is offered, and that same-channel retry is itself currently blocked by the pre-existing "already in progress" guard, not by anything new).
- **Xendit itself** — no evidence of a Xendit-side failure; the session was created successfully and a webhook *was* sent.

## 5. Duplicate-charge risk

**None, by the existing design, even in the worst case.** If Xendit did in fact charge the card successfully and this simply stays unreconciled, the *only* two ways this order can be acted on again both go through the existing stale-attempt safety net (unchanged by the Checkout-architecture work):
- Right now (session not yet stale): any retry attempt is flatly refused with "a card payment is already in progress" — no new session, no new charge.
- After 13:53:23 UTC (session goes stale): the next retry click runs `reconcileStaleXenditAttempt` first, which calls Xendit's own session-status API before doing anything else. If Xendit reports it already completed, the attempt is marked paid and the retry is refused — never a second charge. A new session is only ever created if Xendit itself confirms the old one is genuinely dead.
- The nightly cron (03:00 UTC) will independently reconcile this same session the same way if no one retries manually first.

So this is a **visibility/reconciliation bug, not a billing-safety bug** — the existing idempotency and reconcile-before-retry protections (§7 of `docs/payment-ux-architecture-audit.md`) are intact and would prevent an overcharge regardless of what actually happened at Xendit.

---

## Smallest safe fix (not implemented — audit only)

1. **Make unrecognized webhook payloads forensically recoverable.** In `src/app/api/webhooks/xendit/route.ts`'s `if (!referenceId || !status)` branch, persist the *full* raw payload somewhere queryable (a new minimal audit table, or relax `payment_webhook_events.reference_id`'s `not null`/type constraints to allow logging a null-reference row with the raw body) instead of only a `console.error` summary. This is the highest-leverage first step — right now, every time this shape shows up, the exact cause is unrecoverable after the fact, which is why this is the *second* time this exact class of bug has caused a stuck-but-possibly-paid order without a diagnosable trail.
2. **Once the actual payload shape is captured from a live occurrence**, extend the route's `referenceId`/`status` extraction (or add a dedicated `payment_session.*` shape branch) to handle it, mirroring how `reconcileStaleXenditAttempt` already normalizes Xendit's session-level `"COMPLETED"` status to the payment-level `"SUCCEEDED"` vocabulary (`src/features/payments/lib/xendit-reconciliation.ts`) — the webhook route currently has no equivalent normalization for whatever this third shape's status field looks like.
3. **Immediate, safe unblock for this specific stuck order** (no code change): either wait for the session to go stale (13:53:23 UTC) and let the buyer's own Retry click self-heal via `reconcileStaleXenditAttempt`, or wait for the 03:00 UTC cron sweep to do the same automatically. Both already call Xendit's real status before touching anything — genuinely safe, no implementation needed.

**Affected files (for the eventual fix, not touched now):**
- `src/app/api/webhooks/xendit/route.ts` (payload recognition + persistence of unrecognized payloads)
- Possibly a new migration for an "unrecognized webhook payloads" audit table, or a relaxation of `payment_webhook_events`'s schema to accept a null/unresolved reference
- `docs/DECISIONS.md` / `ARCHITECTURE.md` Technical Debt Register — this gap is already partially acknowledged there per the route's own comments; worth promoting to a tracked entry given it's now recurred twice
