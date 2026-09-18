"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import { createRefund } from "@/lib/xendit/client";
import type { Json } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/types/action.types";
import {
  decideReturnSchema,
  requestReturnSchema,
  respondToReturnSchema,
} from "@/features/returns/schemas/return.schema";
import type {
  AdminReturnDecision,
  SellerReturnDecision,
} from "@/features/returns/types/return.types";

/**
 * Buyer submits a return/refund request for one of their own delivered
 * orders, with an optional evidence photo. Ownership, order status
 * ('delivered'), and duplicate-request checks all happen inside the
 * `request_return` RPC (`queries.requestReturn`) — this action validates
 * input and uploads the file, nothing more.
 */
export async function requestReturnAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = requestReturnSchema.safeParse({
    orderId: formData.get("orderId"),
    orderItemId: formData.get("orderItemId") || undefined,
    reason: formData.get("reason"),
    evidence: formData.get("evidence"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Throws when unauthenticated — the action never trusts the client,
    // even though the RPC re-checks ownership independently.
    await queries.requireSessionUser();

    const evidencePath = parsed.data.evidence
      ? await queries.uploadReturnEvidence(parsed.data.orderId, parsed.data.evidence)
      : null;

    await queries.requestReturn(
      parsed.data.orderId,
      parsed.data.orderItemId ?? null,
      parsed.data.reason,
      evidencePath,
    );

    revalidatePath(ROUTES.orderDetail(parsed.data.orderId));
    revalidatePath(ROUTES.orders, "layout");
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not submit your return request.",
    );
  }
}

/**
 * The order's own seller, or admin, accepts/rejects a pending return
 * request. Authorization is enforced inside the `respond_to_return` RPC
 * (own order or `is_admin()`); `requireRole` here is defense-in-depth, not
 * the primary boundary.
 */
export async function respondToReturnAction(
  returnId: string,
  decision: SellerReturnDecision,
  note?: string,
): Promise<ActionResult<null>> {
  const parsed = respondToReturnSchema.safeParse({ returnId, decision, note });
  if (!parsed.success) return fail("Invalid request.");

  try {
    await queries.requireRole(DASHBOARD_ROLES);
    await queries.respondToReturn(
      parsed.data.returnId,
      parsed.data.decision,
      parsed.data.note ?? null,
    );
    revalidatePath(ROUTES.adminOrders);
    revalidatePath(ROUTES.sellerOrders);
    revalidatePath(ROUTES.adminReturns);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not respond to this return request.",
    );
  }
}

/**
 * Admin-only: approves or rejects a return request. Authorization is
 * enforced inside the `decide_return` RPC itself (`is_admin()` re-derived,
 * never trusted from the caller's role claim); `requireRole` here is
 * defense-in-depth, not the primary boundary.
 *
 * Phase 5B: for a COD (or legacy) payment, `decide_return` finalizes
 * immediately exactly as before — nothing else to do here. For a Xendit
 * payment, `decide_return` only submits a pending refund attempt; this
 * action then makes the actual `POST /refunds` call and records the
 * outcome. If Xendit's call itself fails (never even got a response), the
 * attempt is marked failed immediately so the admin can safely retry —
 * `return_requests`/`payments`/`orders` were never touched by the approval
 * step, so there is nothing to undo. If the call succeeds, the attempt
 * stays "pending" from our own database's point of view until the real
 * `refund.succeeded`/`refund.failed` webhook confirms it — this action
 * never marks anything refunded itself.
 */
export async function decideReturnAction(
  returnId: string,
  decision: AdminReturnDecision,
  note?: string,
): Promise<ActionResult<null>> {
  const parsed = decideReturnSchema.safeParse({ returnId, decision, note });
  if (!parsed.success) return fail("Invalid request.");

  try {
    await queries.requireRole(DASHBOARD_ROLES);
    await queries.decideReturn(
      parsed.data.returnId,
      parsed.data.decision,
      parsed.data.note ?? null,
    );

    if (parsed.data.decision === "approve") {
      const pendingRefund = await queries.getPendingXenditRefundForReturn(parsed.data.returnId);
      if (pendingRefund) {
        try {
          const response = await createRefund({
            paymentRequestId: pendingRefund.xenditPaymentRequestId,
            amountCents: pendingRefund.amountCents,
            currency: pendingRefund.currency,
            idempotencyKey: pendingRefund.id,
          });
          await queries.recordXenditRefundSubmission(
            pendingRefund.id,
            response.id,
            response as unknown as Json,
          );
        } catch (error) {
          await queries.failXenditRefundSubmission(
            pendingRefund.id,
            error instanceof Error ? error.message : "Xendit refund request failed.",
          );
          return fail(
            "Could not submit the refund to Xendit. Nothing was charged or refunded — you can safely try again.",
          );
        }
      }
    }

    revalidatePath(ROUTES.adminReturns);
    revalidatePath(ROUTES.adminOrders);
    revalidatePath(ROUTES.sellerOrders);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not decide this return request.",
    );
  }
}
