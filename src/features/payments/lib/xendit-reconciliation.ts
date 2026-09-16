import {
  getCardSessionStatus,
  getPaymentRequestStatus,
  xenditAmountToCents,
} from "@/lib/xendit/client";
import * as queries from "@/lib/supabase/queries";
import type { PaymentAttempt } from "@/features/payments/types/payment.types";

/**
 * Shared by fix #5A (reconcile before replacing a stale payment) and fix #5B
 * (reconcile before cancelling a stale payment). Deliberately a plain
 * module, not a `"use server"` action file — these are internal helpers,
 * not Server Actions, and exporting them from a `"use server"` file would
 * incorrectly expose them as directly callable actions.
 */

/** Buyer-facing message when a reconciliation check can't confirm Xendit's status. Never safe to proceed (new charge or cancellation) in this state. */
export const RECONCILIATION_RETRY_MESSAGE =
  "We're still confirming your previous payment attempt with Xendit. Please wait a moment and try again.";

/**
 * Mirrors the DB-side fix #4 staleness window (`begin_xendit_payment_attempt`
 * / `begin_xendit_group_payment_attempt` / `enforce_order_update_rules`) so
 * callers only reconcile when the DB would actually be about to treat this
 * attempt as abandoned — a still-fresh attempt needs no Xendit API call.
 * Keep this window in sync with the migration if either changes.
 */
export function isStaleXenditAttempt(attempt: PaymentAttempt): boolean {
  if (attempt.expiresAt) {
    return new Date(attempt.expiresAt).getTime() <= Date.now();
  }
  const fallbackMinutes = attempt.paymentChannel === "CARD" ? 30 : 20;
  return Date.now() - new Date(attempt.createdAt).getTime() > fallbackMinutes * 60 * 1000;
}

export type ReconciliationOutcome = "already_paid" | "cleared_for_retry" | "blocked";

/**
 * Before a stale-by-our-clock attempt is treated as abandoned -- whether
 * that means starting a fresh charge (fix #5A) or allowing the order to be
 * cancelled (fix #5B) -- ask Xendit directly what actually happened. Xendit's
 * answer is applied through `reconcileXenditWebhookStatus`, which is the
 * exact same `process_xendit_webhook` RPC the real webhook uses -- no
 * payment-status logic is duplicated here. `referenceId` is the payment
 * row's own id for a single order, or the `checkoutGroupId` for a combined
 * group payment -- matching whichever value was originally sent to Xendit
 * as `reference_id`.
 */
export async function reconcileStaleXenditAttempt(
  referenceId: string,
  channelCode: "GCASH" | "PAYMAYA" | "CARD",
  existing: PaymentAttempt,
): Promise<ReconciliationOutcome> {
  if (!existing.xenditPaymentRequestId) return "cleared_for_retry";

  let rawStatus: string;
  let amountCents = existing.amountCents;
  let currency = existing.currency;
  let xenditPaymentId = "";

  try {
    if (channelCode === "CARD") {
      const session = await getCardSessionStatus(existing.xenditPaymentRequestId);
      // Session-level "COMPLETED" is normalized to the payment-level
      // "SUCCEEDED" process_xendit_webhook expects — the exact status
      // vocabulary Xendit uses for a completed Card session is unconfirmed
      // against a live sandbox response (see client.ts), so this mapping is
      // defensive, not a guarantee. Any other session status (ACTIVE,
      // EXPIRED, CANCELED, or unrecognized) passes through unchanged.
      rawStatus = session.status === "COMPLETED" ? "SUCCEEDED" : session.status;
      if (typeof session.amount === "number") amountCents = xenditAmountToCents(session.amount);
      if (session.currency) currency = session.currency;
      if (session.payment_id) xenditPaymentId = session.payment_id;
    } else {
      const request = await getPaymentRequestStatus(existing.xenditPaymentRequestId);
      rawStatus = request.status;
      if (typeof request.request_amount === "number") {
        amountCents = xenditAmountToCents(request.request_amount);
      }
      if (request.currency) currency = request.currency;
      if (request.payment_id) xenditPaymentId = request.payment_id;
    }
  } catch {
    // Network error, timeout, non-2xx from Xendit — never safe to assume
    // abandonment from a failed status check.
    return "blocked";
  }

  let reconciled: PaymentAttempt | null;
  try {
    reconciled = await queries.reconcileXenditWebhookStatus({
      referenceId,
      xenditPaymentRequestId: existing.xenditPaymentRequestId,
      xenditPaymentId,
      status: rawStatus,
      channelCode,
      amountCents,
      currency,
    });
  } catch {
    return "blocked";
  }

  if (reconciled?.status === "paid") return "already_paid";
  if (reconciled?.status === "failed") return "cleared_for_retry";
  // Anything else (still pending/processing on Xendit's side, or an
  // unrecognized status process_xendit_webhook logged as
  // ignored_transient_status) -- never safe to proceed while the existing
  // attempt might still resolve successfully.
  return "blocked";
}
