"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import type { Order } from "@/features/orders/types/order.types";

export interface BuyAgainButtonProps {
  order: Order;
  /** Resolved shop/seller label — see `AddToCartButton`'s prop of the same name. */
  sellerName?: string | null;
}

/**
 * Re-adds every re-orderable line from a past order to the cart, then goes
 * to the cart (not straight to checkout) so the buyer can review quantities
 * first. Items whose product no longer resolves (`productSlug` is null —
 * sold/archived, per `OrderItem`'s doc comment) are skipped; the cart page's
 * existing availability check catches anything else that's changed since
 * (price, remaining stock).
 */
export function BuyAgainButton({ order, sellerName }: BuyAgainButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();

  const reorderableItems = order.items.filter((item) => item.productSlug !== null);
  if (reorderableItems.length === 0) return null;

  const resolvedSellerName =
    sellerName ?? (order.sellerRole === USER_ROLES.seller ? order.sellerName : null);

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
        sellerName: resolvedSellerName,
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
