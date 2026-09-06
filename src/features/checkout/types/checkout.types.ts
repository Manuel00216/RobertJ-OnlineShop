import type { CartItem } from "@/features/cart/types/cart.types";

/**
 * Payment method selected at checkout. The Stripe/card spike (ADR-014) and
 * the QR/manual-verification flow have both been retired — COD and Xendit
 * Online Payment (GCash, Maya, Card) are the only two options. Selecting
 * `xendit` here is purely informational — nothing is persisted at
 * order-placement time (`create_order` is unchanged); the buyer actually
 * starts the Xendit payment afterward from the order detail page.
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

/** A successfully created order. `productIds` lets the client clear placed items. */
export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string | null;
  productIds: string[];
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
}
