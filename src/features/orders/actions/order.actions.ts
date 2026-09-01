"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  advanceOrderStatusSchema,
  cancelOrderSchema,
} from "@/features/orders/schemas/order.schema";
import type { Order } from "@/features/orders/types/order.types";

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
    // Defense-in-depth beyond RLS: a non-admin's own seller_id is enforced
    // again here.
    const order = await queries.advanceOrderStatus(
      parsed.data.orderId,
      parsed.data.newStatus,
      user.role === USER_ROLES.admin ? null : user.id,
    );
    revalidatePath(ROUTES.dashboardOrders, "layout");
    revalidatePath(ROUTES.dashboardOrderDetail(order.id), "layout");
    revalidatePath(ROUTES.adminOrders, "layout");
    revalidatePath(ROUTES.adminOrderDetail(order.id), "layout");
    revalidatePath(ROUTES.orderDetail(order.id), "layout");
    revalidatePath(ROUTES.orders, "layout");
    return ok(order);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the order.",
    );
  }
}
