"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { CHECKOUT_CONSTANTS } from "@/features/checkout/constants/checkout.constants";
import { placeOrderSchema } from "@/features/checkout/schemas/checkout.schema";
import type {
  FailedGroup,
  PlaceOrderResult,
  PlacedOrder,
} from "@/features/checkout/types/checkout.types";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";

/**
 * Places the buyer's cart — one `create_order` call per seller group. The RPC is
 * atomic per seller and re-prices from the DB, so a group can fail independently
 * (e.g. "Only 2 left of X"). The result reports every created and failed group so
 * the client clears only placed items and keeps failed ones in the cart.
 */
export async function placeOrderAction(
  input: unknown,
): Promise<ActionResult<PlaceOrderResult>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Throws when unauthenticated — the action never trusts the client.
    const user = await queries.requireSessionUser();
    // Throttle order creation per buyer, matching the other order mutations
    // (cancel/advance). Guards against order-spam and repeated stock-lock churn.
    await queries.requireRateLimit(`placeOrder:${user.id}`, 10, 60);

    const created: PlacedOrder[] = [];
    const failed: FailedGroup[] = [];

    for (const group of parsed.data.groups) {
      // camelCase domain → snake_case jsonb keys the DB CHECK requires.
      const shippingAddress = {
        full_name: parsed.data.address.fullName,
        line1: parsed.data.address.line1,
        line2: parsed.data.address.line2 || null,
        city: parsed.data.address.city,
        postal_code: parsed.data.address.postalCode,
        country: parsed.data.address.country,
        phone: parsed.data.address.phone || null,
      };

      try {
        const order = await queries.createOrder({
          sellerId: group.sellerId,
          items: group.items,
          shippingAddress,
          shippingFeeCents: CHECKOUT_CONSTANTS.shippingFeeCentsPerSeller,
        });
        created.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          sellerName: group.sellerName ?? null,
          productIds: group.items.map((item) => item.productId),
        });
      } catch (error) {
        failed.push({
          sellerId: group.sellerId,
          sellerName: group.sellerName ?? null,
          reason:
            error instanceof Error
              ? error.message
              : "We couldn't place this order.",
        });
      }
    }

    if (created.length > 0) {
      // Re-render the buyer's order history and overview so the new orders appear.
      revalidatePath(ROUTES.orders, "layout");
      revalidatePath(ROUTES.account, "layout");
    }

    return ok({ created, failed });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not place your order.",
    );
  }
}
