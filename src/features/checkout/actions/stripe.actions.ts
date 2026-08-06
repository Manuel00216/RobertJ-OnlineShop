"use server";

import { z } from "zod";

import { createPaymentIntentForOrder } from "@/lib/stripe";
import { fail, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import { uuidSchema } from "@/lib/validations/common.schema";
import type { ActionResult } from "@/types/action.types";

const createCheckoutIntentSchema = z.object({
  orderId: uuidSchema,
});

/**
 * Creates a Stripe Payment Intent for one of the buyer's own orders (ownership
 * verified via `getBuyerOrder`). The order's `payment_status` is left `pending` —
 * only the Module-7 webhook may move it to a final state, and this action never
 * touches inventory or fulfillment. Amounts come from the DB, never the client.
 */
export async function createCheckoutIntentAction(
  input: unknown,
): Promise<
  ActionResult<{
    clientSecret: string;
    orderId: string;
    amountCents: number;
    currency: string;
  }>
> {
  const parsed = createCheckoutIntentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Order not found.");
  }

  try {
    const user = await queries.requireSessionUser();
    const order = await queries.getBuyerOrder(parsed.data.orderId, user.id);
    if (!order) {
      return fail("Order not found.");
    }
    if (order.paymentStatus !== "pending") {
      return fail("This order has already been paid.");
    }

    const intent = await createPaymentIntentForOrder(order, user.id);
    if (!intent.client_secret) {
      return fail("Stripe could not start this payment.");
    }

    return ok({
      clientSecret: intent.client_secret,
      orderId: order.id,
      amountCents: order.totalCents,
      currency: order.currency,
    });
  } catch {
    return fail("We couldn't start the payment. Please try again.");
  }
}
