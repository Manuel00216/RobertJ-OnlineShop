"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { fail, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { cancelOrderSchema } from "@/features/orders/schemas/order.schema";

/**
 * Cancels one of the signed-in buyer's own orders. Ownership + the
 * cancellable-state rule are enforced server-side in `queries.cancelBuyerOrder`
 * (RLS is the final boundary).
 */
export async function cancelOrderAction(
  orderId: string,
): Promise<ActionResult<null>> {
  const parsed = cancelOrderSchema.safeParse({ orderId });
  if (!parsed.success) {
    return fail("Order not found.");
  }

  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`cancelOrder:${user.id}`, 10, 60);
    await queries.cancelBuyerOrder(parsed.data.orderId, user.id);
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
