import { siteConfig } from "@/config/site";
import type { CartItem } from "@/features/cart/types/cart.types";
import { CHECKOUT_CONSTANTS } from "@/features/checkout/constants/checkout.constants";
import type { CheckoutGroup } from "@/features/checkout/types/checkout.types";

/**
 * Splits a cart into one group per seller — the schema models one order per
 * seller (see `docs/database.md` §3.2), so a mixed cart becomes several orders.
 * Pure and deterministic so it stays testable. Older carts without `sellerName`
 * fall back to a neutral label.
 */
export function groupCartBySeller(items: CartItem[]): CheckoutGroup[] {
  const bySeller = new Map<string, CartItem[]>();
  for (const item of items) {
    const list = bySeller.get(item.sellerId) ?? [];
    list.push(item);
    bySeller.set(item.sellerId, list);
  }

  return [...bySeller.entries()].map(([sellerId, sellerItems]) => {
    const subtotalCents = sellerItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    const shippingFeeCents = CHECKOUT_CONSTANTS.shippingFeeCentsPerSeller;
    return {
      sellerId,
      sellerName: sellerItems[0]?.sellerName ?? null,
      items: sellerItems,
      subtotalCents,
      shippingFeeCents,
      totalCents: subtotalCents + shippingFeeCents,
      currency: sellerItems[0]?.currency ?? siteConfig.currency,
    };
  });
}
