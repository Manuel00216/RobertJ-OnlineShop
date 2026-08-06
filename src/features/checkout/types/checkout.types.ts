import type { CartItem } from "@/features/cart/types/cart.types";

/**
 * Payment method selected at checkout. The Stripe/card spike (ADR-014) was
 * retired. Selecting `qr_upload` here is purely informational — nothing is
 * persisted at order-placement time (`create_order` is unchanged); the buyer
 * actually submits a receipt afterward from the order detail page
 * (`submitQrPaymentAction`), which is what creates the `payments` row.
 */
export type PaymentMethod = "cod" | "qr_upload";

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
