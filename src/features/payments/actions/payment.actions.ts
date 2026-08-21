"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  submitQrPaymentSchema,
  verifyPaymentSchema,
} from "@/features/payments/schemas/payment.schema";
import type { PaymentDecision } from "@/features/payments/types/payment.types";

/**
 * Buyer submits a QR transfer receipt for one of their own orders. Ownership
 * and duplicate-submission checks happen inside the `submit_qr_payment` RPC
 * (`queries.submitQrPayment`) — this action validates input and uploads the
 * file, nothing more.
 */
export async function submitQrPaymentAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = submitQrPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    receipt: formData.get("receipt"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Throws when unauthenticated — the action never trusts the client, even
    // though the RPC re-checks ownership independently.
    await queries.requireSessionUser();
    const receiptPath = await queries.uploadPaymentReceipt(
      parsed.data.orderId,
      parsed.data.receipt,
    );
    await queries.submitQrPayment(parsed.data.orderId, receiptPath);
    revalidatePath(ROUTES.orderDetail(parsed.data.orderId));
    revalidatePath(ROUTES.orders, "layout");
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Could not submit your payment receipt.",
    );
  }
}

/**
 * Seller (of the order) or admin marks a pending payment paid/failed.
 * Authorization is enforced inside the `verify_payment` RPC (own order or
 * `is_admin()`); `requireRole` here is defense-in-depth, not the primary
 * boundary.
 */
export async function verifyPaymentAction(
  paymentId: string,
  decision: PaymentDecision,
  reason?: string,
): Promise<ActionResult<null>> {
  const parsed = verifyPaymentSchema.safeParse({ paymentId, decision, reason });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole(DASHBOARD_ROLES);
    await queries.verifyPayment(
      parsed.data.paymentId,
      parsed.data.decision,
      parsed.data.reason ?? null,
    );
    revalidatePath(ROUTES.paymentVerification);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not verify this payment.",
    );
  }
}
