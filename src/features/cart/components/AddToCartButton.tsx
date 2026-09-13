"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { USER_ROLES } from "@/constants/roles";
import { useCart } from "@/features/cart/hooks/useCart";
import {
  getCoverImage,
  type Product,
} from "@/features/products/types/product.types";

/** The buyer's fully-resolved variant selection, ready to add to the cart. */
export interface SelectedVariantInfo {
  id: string;
  label: string;
  priceCents: number;
  stock: number;
}

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
  /**
   * Omit entirely for a plain product (today's exact behavior). When the
   * product has variants, pass the buyer's current selection — `null` while
   * required attributes are still unpicked (disables the button), or the
   * resolved variant once complete.
   */
  variant?: SelectedVariantInfo | null;
}

export function AddToCartButton({
  product,
  quantity = 1,
  className,
  buttonVariant = "primary",
  sellerName,
  variant,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const hasVariants = variant !== undefined;
  const isOutOfStock = hasVariants
    ? variant === null || variant.stock <= 0
    : product.quantity <= 0;

  function handleAdd() {
    if (hasVariants && !variant) return;
    addItem({
      productId: product.id,
      variantId: variant?.id,
      variantLabel: variant?.label ?? null,
      slug: product.slug,
      title: product.title,
      imageUrl: getCoverImage(product)?.url ?? null,
      unitPriceCents: variant ? variant.priceCents : product.priceCents,
      currency: product.currency,
      quantity,
      maxQuantity: variant ? variant.stock : product.quantity,
      sellerId: product.sellerId,
      sellerName:
        sellerName ?? (product.sellerRole === USER_ROLES.seller ? product.sellerName : null),
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  const rj = buttonVariant === "rj";
  const label = isOutOfStock
    ? hasVariants && variant === null
      ? "Select options"
      : "Sold out"
    : justAdded
      ? "Added to cart"
      : "Add to cart";

  return (
    <Button
      type="button"
      variant={isOutOfStock ? "outline" : rj ? "rj" : "primary"}
      size={rj ? "rj" : "md"}
      className={className}
      disabled={isOutOfStock}
      onClick={handleAdd}
    >
      <span aria-live="polite">{label}</span>
    </Button>
  );
}
