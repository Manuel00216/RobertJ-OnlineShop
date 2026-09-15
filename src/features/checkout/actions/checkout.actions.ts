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

    // camelCase domain → snake_case jsonb keys. full_name/line1/city/
    // postal_code/country are the CHECK-required keys; barangay/province/
    // region are extra keys the constraint permits but doesn't require —
    // see `orders_shipping_address_required_keys` and this migration's
    // header comment (20260912000000_addresses.sql).
    const shippingAddress = {
      full_name: parsed.data.address.fullName,
      line1: parsed.data.address.line1,
      line2: parsed.data.address.line2 || null,
      barangay: parsed.data.address.barangay || null,
      city: parsed.data.address.city,
      province: parsed.data.address.province || null,
      region: parsed.data.address.region || null,
      postal_code: parsed.data.address.postalCode,
      country: parsed.data.address.country,
      phone: parsed.data.address.phone || null,
    };

    // Multi-seller cart + Online Payment: one combined payment will cover
    // every order, so creation must be all-or-nothing (create_order_group)
    // rather than the per-seller partial-success loop below — a combined
    // charge can't meaningfully cover a partial set of orders. Single-seller
    // Online Payment and COD are entirely unaffected and keep the existing
    // per-seller loop and partial-success behavior, unchanged.
    if (parsed.data.paymentMethod === "xendit" && parsed.data.groups.length > 1) {
      const group = await queries.createOrderGroup({
        groups: parsed.data.groups.map((g) => ({ sellerId: g.sellerId, items: g.items })),
        shippingAddress,
        shippingFeeCents: CHECKOUT_CONSTANTS.shippingFeeCentsPerSeller,
        notes: parsed.data.notes || null,
      });

      const created: PlacedOrder[] = group.orders.map((order) => {
        const sourceGroup = parsed.data.groups.find((g) => g.sellerId === order.sellerId);
        return {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          sellerName: sourceGroup?.sellerName ?? null,
          lines: (sourceGroup?.items ?? []).map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          })),
        };
      });

      revalidatePath(ROUTES.orders, "layout");
      revalidatePath(ROUTES.account, "layout");

      return ok({ created, failed: [], checkoutGroupId: group.checkoutGroupId });
    }

    const created: PlacedOrder[] = [];
    const failed: FailedGroup[] = [];

    for (const group of parsed.data.groups) {
      try {
        const order = await queries.createOrder({
          sellerId: group.sellerId,
          items: group.items,
          shippingAddress,
          shippingFeeCents: CHECKOUT_CONSTANTS.shippingFeeCentsPerSeller,
          notes: parsed.data.notes || null,
        });
        created.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          sellerName: group.sellerName ?? null,
          lines: group.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          })),
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
