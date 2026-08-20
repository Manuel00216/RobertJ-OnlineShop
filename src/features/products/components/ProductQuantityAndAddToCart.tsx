"use client";

import { useState } from "react";

import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import type { WishlistState } from "@/features/wishlist/types/wishlist.types";
import type { Product } from "@/features/products/types/product.types";

export interface ProductQuantityAndAddToCartProps {
  product: Product;
  wishlist: WishlistState;
  className?: string;
}

/** PDP quantity selector + Add to cart + wishlist, kept together since the
 * cart button needs the live quantity. */
export function ProductQuantityAndAddToCart({
  product,
  wishlist,
  className,
}: ProductQuantityAndAddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const isOutOfStock = product.quantity <= 0;

  return (
    <div className={className}>
      {isOutOfStock ? null : (
        <div className="mb-3">
          <QuantityStepper
            value={quantity}
            max={product.quantity}
            onChange={setQuantity}
            aria-label={`Quantity for ${product.title}`}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <AddToCartButton
          product={product}
          quantity={quantity}
          buttonVariant="rj"
          className="w-full sm:w-auto"
        />
        <WishlistButton
          productId={wishlist.productId}
          initialSaved={wishlist.initialSaved}
          isAuthenticated={wishlist.isAuthenticated}
          variant="pdp"
        />
      </div>
    </div>
  );
}
