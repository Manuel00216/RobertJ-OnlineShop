import type { CartItem, CartLineRef } from "@/features/cart/types/cart.types";

/**
 * Payment method selected at checkout. The Stripe/card spike (ADR-014) and
 * the QR/manual-verification flow have both been retired — COD and Xendit
 * Online Payment (GCash, Maya, Card) are the only two options.
 *
 * Selecting `xendit` is purely informational at order-placement time in both
 * cases — nothing is persisted here. For a single-seller cart, the buyer
 * starts the Xendit payment afterward from the order detail page, unchanged.
 * For a multi-seller cart, orders are placed atomically via
 * `create_order_group` and the buyer picks the channel (GCash/Maya/Card)
 * afterward on the checkout confirmation page, which starts one combined
 * payment for the whole group — see `checkout/confirmation/page.tsx`.
 */
export type PaymentMethod = "cod" | "xendit";

/** One seller's slice of the cart, ready to render and to submit. */
export interface CheckoutGroup {
  sellerId: string;
  sellerName: string | null;
  items: CartItem[];
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  currency: string;
}

/** A successfully created order. `lines` lets the client clear exactly the placed cart lines (product + variant). */
export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string | null;
  lines: CartLineRef[];
}

/** A seller group the RPC refused (e.g. "Only 2 left of X"). Its items stay in the cart. */
export interface FailedGroup {
  sellerId: string;
  sellerName: string | null;
  reason: string;
}

/** Result of placing a (possibly multi-seller) cart — partial success is explicit. */
export interface PlaceOrderResult {
  created: PlacedOrder[];
  failed: FailedGroup[];
  /**
   * Set only when a multi-seller cart was placed with Online Payment —
   * `created` are all-or-nothing in that case (no partial success), and this
   * is the handle the client uses to immediately start the combined payment.
   * Undefined for COD and single-seller checkouts.
   */
  checkoutGroupId?: string;
}
