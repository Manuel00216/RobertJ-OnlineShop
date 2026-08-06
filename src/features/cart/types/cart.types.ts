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
  /**
   * Seller display name, carried so checkout can label order groups. Older
   * carts may lack it (localStorage migration note) — treat as null.
   */
  sellerName: string | null;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | { type: "add"; item: CartItem }
  | { type: "remove"; productId: string }
  | { type: "removeMany"; productIds: string[] }
  | { type: "setQuantity"; productId: string; quantity: number }
  /**
   * Applies a server-confirmed price/stock correction to one line. Requires
   * an explicit user action (e.g. clicking "Update") — never dispatched
   * automatically just because a mismatch was detected.
   */
  | {
      type: "updateItem";
      productId: string;
      patch: Partial<Pick<CartItem, "unitPriceCents" | "maxQuantity">>;
    }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };
