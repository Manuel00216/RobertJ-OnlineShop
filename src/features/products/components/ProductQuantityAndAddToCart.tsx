"use client";

import { useState } from "react";

import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import type { Product } from "@/features/products/types/product.types";

export interface ProductQuantityAndAddToCartProps {
  product: Product;
  className?: string;
}

/** PDP quantity selector + Add to cart, kept together since the button needs the live quantity. */
export function ProductQuantityAndAddToCart({
  product,
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
      <AddToCartButton
        product={product}
        quantity={quantity}
        buttonVariant="rj"
        className="w-full sm:w-auto"
      />
    </div>
  );
}
