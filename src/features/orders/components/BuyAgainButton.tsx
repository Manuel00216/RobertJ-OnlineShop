"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import type { Order } from "@/features/orders/types/order.types";

export interface BuyAgainButtonProps {
  order: Order;
}

/**
 * Re-adds every re-orderable line from a past order to the cart, then goes
 * to the cart (not straight to checkout) so the buyer can review quantities
 * first. Items whose product no longer resolves (`productSlug` is null —
 * sold/archived, per `OrderItem`'s doc comment) are skipped; the cart page's
 * existing availability check catches anything else that's changed since
 * (price, remaining stock).
 */
export function BuyAgainButton({ order }: BuyAgainButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();

  const reorderableItems = order.items.filter((item) => item.productSlug !== null);
  if (reorderableItems.length === 0) return null;

  function handleBuyAgain() {
    for (const item of reorderableItems) {
      addItem({
        productId: item.productId,
        // Non-null asserted: `reorderableItems` already filtered these out.
        slug: item.productSlug!,
        title: item.productTitle,
        imageUrl: item.imageUrl,
        unitPriceCents: item.unitPriceCents,
        currency: order.currency,
        quantity: item.quantity,
        maxQuantity: item.quantity,
        sellerId: order.sellerId,
        sellerName: order.sellerName,
      });
    }
    router.push(ROUTES.cart);
  }

  return (
    <Button type="button" variant="rjOutline" size="rjSm" onClick={handleBuyAgain}>
      🔄 Buy Again
    </Button>
  );
}
