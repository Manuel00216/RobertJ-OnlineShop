import type { CartItem, CartLineRef } from "@/features/cart/types/cart.types";
import type { LifecycleTab } from "@/features/orders";

/**
 * Payment method selected at checkout. The Stripe/card spike (ADR-014) and
 * the QR/manual-verification flow have both been retired — COD and Xendit
 * Online Payment (GCash, Maya, Card) are the only two options.
 *
 * The channel (GCash/Maya/Card) is chosen once, at checkout, in
 * `CheckoutForm` — never re-asked afterward. `placeOrderAction` eagerly
 * reserves the matching Xendit payment attempt right away (for every
 * channel, not just GCash/Maya), so the order is correctly classified "To
 * Pay" the instant it's created. GCash/Maya then continue immediately into
 * Xendit's hosted checkout; Card's session only actually starts later, from
 * the order's "To Pay" card on `/orders` (its widget needs a buyer-
 * interactive, mounted DOM it can't get from a Server Action redirect
 * chain). There is no dedicated checkout-confirmation page — every path
 * lands on `/orders`.
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
  /**
   * Which `/orders` lifecycle tab the just-placed order(s) landed on,
   * resolved server-side from `buyer_order_lifecycle` (see
   * `resolveRedirectTab` in `checkout.actions.ts`) — `null` means "All"
   * (COD orders, or the defensive case where created orders span more than
   * one tab). `CheckoutForm` redirects using this value directly; it never
   * re-derives the tab mapping itself.
   */
  redirectTab: LifecycleTab | null;
}
