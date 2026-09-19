"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  RECONCILIATION_RETRY_MESSAGE,
  isStaleXenditAttempt,
  reconcileStaleXenditAttempt,
} from "@/features/payments/lib/xendit-reconciliation";
import {
  advanceOrderStatusSchema,
  cancelOrderSchema,
} from "@/features/orders/schemas/order.schema";
import type { Order } from "@/features/orders/types/order.types";

/**
 * Fix #5B: before letting a cancellation through, resolve any stale (by the
 * fix #4 clock) finalized Xendit payment attached to this order or its
 * checkout group against Xendit's real status — reusing the exact fix #5A
 * building blocks, never duplicating payment-status logic. A still-active
 * (non-stale) attempt needs no Xendit call here at all; the existing
 * `enforce_order_update_rules` guard already blocks cancellation for it.
 *
 * Ordering matters: this MUST run, and complete, before the actual
 * `order_status = 'cancelled'` update is issued. `process_xendit_webhook`
 * has its own "order already cancelled" guard that silently no-ops once the
 * order is cancelled — reconciling afterward would be a permanent no-op and
 * defeat the entire point of this check.
 *
 * Returns an `ActionResult` (always `success: false`) if the cancellation
 * must be blocked, or `null` if it's safe to proceed.
 */
async function blockCancellationIfXenditUnresolved(
  orderId: string,
): Promise<ActionResult<never> | null> {
  const candidates = await queries.getFinalizedPendingXenditAttemptsForCancellation(orderId);

  for (const candidate of candidates) {
    if (!isStaleXenditAttempt(candidate.attempt)) continue;

    const outcome = await reconcileStaleXenditAttempt(
      candidate.referenceId,
      candidate.channelCode,
      candidate.attempt,
    );
    if (outcome === "blocked") {
      return fail(RECONCILIATION_RETRY_MESSAGE);
    }
    // "already_paid" or "cleared_for_retry": the ledger is now accurate for
    // this candidate (paid orders remain cancellable, unchanged from
    // today; a genuinely failed/expired attempt no longer blocks anything).
    // Continue checking any other stale candidate before proceeding.
  }

  return null;
}

/**
 * Cancels one of the signed-in buyer's own orders. Ownership + the
 * cancellable-state rule are enforced server-side in `queries.cancelBuyerOrder`
 * (RLS is the final boundary).
 */
export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<ActionResult<null>> {
  const parsed = cancelOrderSchema.safeParse({ orderId, reason });
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`cancelOrder:${user.id}`, 10, 60);

    const blocked = await blockCancellationIfXenditUnresolved(parsed.data.orderId);
    if (blocked) return blocked;

    await queries.cancelBuyerOrder(parsed.data.orderId, user.id, parsed.data.reason);
    // Re-render the history list and the detail page so the timeline updates.
    revalidatePath(ROUTES.orders, "layout");
    revalidatePath(ROUTES.orderDetail(parsed.data.orderId), "layout");
    revalidatePath(ROUTES.account, "layout");
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not cancel the order.",
    );
  }
}

/**
 * Advances (or cancels) an order's fulfilment status from the dashboard.
 * One action for both: cancelling is just another legal transition target
 * per `ORDER_STATUS_TRANSITIONS`. Revalidates the dashboard list/detail *and*
 * the buyer-facing detail page, so the buyer's already-rendered order view
 * doesn't show a stale status.
 */
export async function advanceOrderStatusAction(
  orderId: string,
  newStatus: string,
): Promise<ActionResult<Order>> {
  const parsed = advanceOrderStatusSchema.safeParse({ orderId, newStatus });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireRole(DASHBOARD_ROLES);
    await queries.requireRateLimit(`advanceOrderStatus:${user.id}`, 30, 60);

    if (parsed.data.newStatus === "cancelled") {
      const blocked = await blockCancellationIfXenditUnresolved(parsed.data.orderId);
      if (blocked) return blocked;
    }

    // Defense-in-depth beyond RLS: a non-admin's own seller_id is enforced
    // again here.
    const order = await queries.advanceOrderStatus(
      parsed.data.orderId,
      parsed.data.newStatus,
      user.role === USER_ROLES.admin ? null : user.id,
    );
    revalidatePath(ROUTES.adminOrders, "layout");
    revalidatePath(ROUTES.adminOrderDetail(order.id), "layout");
    revalidatePath(ROUTES.sellerOrders, "layout");
    revalidatePath(ROUTES.sellerOrderDetail(order.id), "layout");
    revalidatePath(ROUTES.orderDetail(order.id), "layout");
    revalidatePath(ROUTES.orders, "layout");
    return ok(order);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the order.",
    );
  }
}
