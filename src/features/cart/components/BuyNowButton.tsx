"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { useCart } from "@/features/cart/hooks/useCart";
import type { SelectedVariantInfo } from "@/features/cart/components/AddToCartButton";
import {
  getCoverImage,
  type Product,
} from "@/features/products/types/product.types";

export interface BuyNowButtonProps {
  product: Product;
  quantity?: number;
  className?: string;
  /** See `AddToCartButton`'s prop of the same name. */
  sellerName?: string | null;
  /** See `AddToCartButton`'s prop of the same name. */
  variant?: SelectedVariantInfo | null;
}

/**
 * Adds the product to the cart, then goes straight to checkout — no new
 * order path, just a shortcut through the existing cart→checkout flow.
 * `/checkout` is already proxy-protected, so a guest lands on sign-in with
 * `redirectTo` preserved, same as clicking "Proceed to checkout" from the
 * cart page; nothing extra to handle here.
 */
export function BuyNowButton({
  product,
  quantity = 1,
  className,
  sellerName,
  variant,
}: BuyNowButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [isPending, setIsPending] = useState(false);
  const hasVariants = variant !== undefined;
  const isOutOfStock = hasVariants
    ? variant === null || variant.stock <= 0
    : product.quantity <= 0;

  function handleBuyNow() {
    if (hasVariants && !variant) return;
    setIsPending(true);
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
    router.push(ROUTES.checkout);
  }

  return (
    <Button
      type="button"
      variant="rjOutline"
      size="rj"
      className={className}
      disabled={isOutOfStock || isPending}
      isLoading={isPending}
      onClick={handleBuyNow}
    >
      Buy Now
    </Button>
  );
}
