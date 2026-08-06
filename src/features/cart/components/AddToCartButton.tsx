"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
}

export function AddToCartButton({
  product,
  quantity = 1,
  className,
  buttonVariant = "primary",
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
      sellerName: product.sellerName,
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
