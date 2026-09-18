"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { markCodPaymentCollectedSchema } from "@/features/payments/schemas/payment.schema";

/**
 * Seller (of the order) or admin marks a COD order's cash as collected.
 * Authorization is enforced inside the `mark_cod_payment_collected` RPC (own
 * order or `is_admin()`) — this action just validates input and delegates.
 * COD never auto-marks paid at order creation; this is the only path.
 */
export async function markCodPaymentCollectedAction(
  orderId: string,
): Promise<ActionResult<null>> {
  const parsed = markCodPaymentCollectedSchema.safeParse({ orderId });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireSessionUser();
    await queries.markCodPaymentCollected(parsed.data.orderId);
    revalidatePath(ROUTES.orderDetail(parsed.data.orderId));
    revalidatePath(ROUTES.orders, "layout");
    revalidatePath(ROUTES.adminPayments);
    revalidatePath(ROUTES.sellerPayments);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not mark this payment as collected.",
    );
  }
}
