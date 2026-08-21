"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { USER_ROLES } from "@/constants/roles";
import { useCart } from "@/features/cart/hooks/useCart";
import {
  getCoverImage,
  type Product,
} from "@/features/products/types/product.types";

export interface AddToCartButtonProps {
  product: Product;
  quantity?: number;
  className?: string;
  /** Visual treatment: default semantic primary, or the rj editorial pill. */
  buttonVariant?: "primary" | "rj";
  /**
   * Resolved shop/seller label for the cart line — pass the same value
   * already shown as "Sold by" on the page (see the PDP), so cart/checkout
   * never disagrees with what the buyer just saw. Falls back to the
   * product's own role-gated name if the caller has nothing better (see
   * `ProductGrid.tsx`'s `toTileItem` for why raw `product.sellerName` alone
   * isn't safe to use).
   */
  sellerName?: string | null;
}

export function AddToCartButton({
  product,
  quantity = 1,
  className,
  buttonVariant = "primary",
  sellerName,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const isOutOfStock = product.quantity <= 0;

  function handleAdd() {
    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      imageUrl: getCoverImage(product)?.url ?? null,
      unitPriceCents: product.priceCents,
      currency: product.currency,
      quantity,
      maxQuantity: product.quantity,
      sellerId: product.sellerId,
      sellerName:
        sellerName ?? (product.sellerRole === USER_ROLES.seller ? product.sellerName : null),
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  const rj = buttonVariant === "rj";

  return (
    <Button
      type="button"
      variant={isOutOfStock ? "outline" : rj ? "rj" : "primary"}
      size={rj ? "rj" : "md"}
      className={className}
      disabled={isOutOfStock}
      onClick={handleAdd}
    >
      <span aria-live="polite">
        {isOutOfStock ? "Sold out" : justAdded ? "Added to cart" : "Add to cart"}
      </span>
    </Button>
  );
}
