import "server-only";

import Stripe from "stripe";

import { getServerEnv } from "@/config/env";
import type { Order } from "@/features/orders/types/order.types";

/**
 * Server-only Stripe client. Never import this from a Client Component.
 * Throws a clear, actionable error if STRIPE_SECRET_KEY isn't configured —
 * Stripe is an experimental spike (see DECISIONS.md -> ADR-014), not the
 * official payment path, so the app must run without it. Callers should
 * either check `isStripeConfigured` first or handle this error gracefully.
 */
export function getStripe(): Stripe {
  const { STRIPE_SECRET_KEY } = getServerEnv();
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured (STRIPE_SECRET_KEY is missing). Card payments are unavailable.",
    );
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

/**
 * Creates a Stripe Payment Intent for an order. The amount always comes from the
 * order's DB-derived `total_cents` (create_order already re-priced from live
 * products) — never from the client. The intent is created but the order's
 * `payment_status` stays `pending`: only the Module-7 webhook may move it to a
 * final state, and inventory/fulfillment are not touched here.
 */
export async function createPaymentIntentForOrder(
  order: Order,
  buyerId: string,
) {
  const stripe = getStripe();
  return stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: order.currency.toLowerCase(),
    metadata: {
      orderId: order.id,
      buyerId,
    },
    automatic_payment_methods: { enabled: true },
  });
}
