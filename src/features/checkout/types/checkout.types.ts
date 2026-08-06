import type { CartItem } from "@/features/cart/types/cart.types";

/** Payment method selected at checkout. */
export type PaymentMethod = "cod" | "card";

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
