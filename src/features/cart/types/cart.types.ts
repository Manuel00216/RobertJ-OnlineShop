export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  /** Stock at the time of adding, used to cap quantity in the UI. */
  maxQuantity: number;
  /**
   * Carried so checkout can group the cart by seller. The schema models one
   * order per seller, so a mixed cart becomes several orders.
   */
  sellerId: string;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | { type: "add"; item: CartItem }
  | { type: "remove"; productId: string }
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };
