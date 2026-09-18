"use client";

import { useMemo, useState } from "react";

import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { BuyNowButton } from "@/features/cart/components/BuyNowButton";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import type { WishlistState } from "@/features/wishlist/types/wishlist.types";
import type { Product, ProductVariant } from "@/features/products/types/product.types";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

export interface ProductQuantityAndAddToCartProps {
  product: Product;
  wishlist: WishlistState;
  className?: string;
  /** The same resolved "Sold by" label already shown on this page — passed
   * through so the cart line never disagrees with it. */
  shopName?: string | null;
  /** Active variants of this product — empty for a plain single-SKU listing. */
  variants: ProductVariant[];
  /** variantId -> live stock, from `getVariantStock`. A missing id has 0 stock. */
  variantStock: Record<string, number>;
}

function uniqueInOrder(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

const OPTION_BUTTON =
  "rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none";

/**
 * PDP quantity selector + Add to cart + wishlist, kept together since the
 * cart button needs the live quantity. When the product has variants, this
 * also owns the Color/Size selectors and the reactive price/stock display —
 * the plain (`variants.length === 0`) path renders exactly as before.
 */
export function ProductQuantityAndAddToCart({
  product,
  wishlist,
  className,
  shopName,
  variants,
  variantStock,
}: ProductQuantityAndAddToCartProps) {
  const hasVariants = variants.length > 0;
  const colors = useMemo(() => uniqueInOrder(variants.map((v) => v.color)), [variants]);
  const sizes = useMemo(() => uniqueInOrder(variants.map((v) => v.size)), [variants]);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = hasVariants
    ? (variants.find(
        (v) =>
          (colors.length === 0 || v.color === selectedColor) &&
          (sizes.length === 0 || v.size === selectedSize),
      ) ?? null)
    : null;

  const needsSelection =
    hasVariants &&
    ((colors.length > 0 && selectedColor === null) || (sizes.length > 0 && selectedSize === null));

  const effectiveStock = hasVariants
    ? needsSelection || !selectedVariant
      ? 0
      : (variantStock[selectedVariant.id] ?? 0)
    : product.quantity;
  const effectivePriceCents = selectedVariant?.priceCents ?? product.priceCents;
  const isOutOfStock = hasVariants
    ? needsSelection || effectiveStock <= 0
    : product.quantity <= 0;

  // Derived, not stored: reclamps automatically whenever effectiveStock
  // shrinks (e.g. switching to a lower-stock variant), no effect needed.
  const clampedQuantity = Math.min(quantity, Math.max(1, effectiveStock));

  const variantInfo = !hasVariants
    ? undefined
    : needsSelection || !selectedVariant
      ? null
      : {
          id: selectedVariant.id,
          label: [selectedVariant.color, selectedVariant.size].filter(Boolean).join(" / "),
          priceCents: effectivePriceCents,
          stock: effectiveStock,
        };

  return (
    <div className={className}>
      {hasVariants ? (
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-2xl font-bold text-rj-black">
              {formatCurrency(effectivePriceCents, product.currency)}
            </p>
            {needsSelection ? (
              <span className="text-xs font-semibold text-rj-gray-500">
                Select options to see stock
              </span>
            ) : effectiveStock > 0 ? (
              <span className="rounded-full bg-rj-green/10 px-3 py-1 text-[11px] font-bold text-rj-green">
                {effectiveStock} in stock
              </span>
            ) : (
              <span className="rounded-full bg-rj-black px-3 py-1 text-[11px] font-bold text-rj-white">
                Out of stock
              </span>
            )}
          </div>

          {colors.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-rj-gray-600">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    aria-pressed={selectedColor === color}
                    className={cn(
                      OPTION_BUTTON,
                      selectedColor === color
                        ? "border-rj-black bg-rj-black text-rj-white"
                        : "border-rj-gray-200 text-rj-black hover:border-rj-black",
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {sizes.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-rj-gray-600">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  // A size is only selectable once it's paired with the
                  // currently chosen color by some real variant row (or
                  // there's no color axis at all).
                  const available = variants.some(
                    (v) => v.size === size && (colors.length === 0 || v.color === selectedColor),
                  );
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={!available}
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={selectedSize === size}
                      className={cn(
                        OPTION_BUTTON,
                        selectedSize === size
                          ? "border-rj-black bg-rj-black text-rj-white"
                          : available
                            ? "border-rj-gray-200 text-rj-black hover:border-rj-black"
                            : "border-rj-gray-100 text-rj-gray-300",
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isOutOfStock ? null : (
        <div className="mb-3">
          <QuantityStepper
            value={clampedQuantity}
            max={effectiveStock}
            onChange={setQuantity}
            aria-label={`Quantity for ${product.title}`}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <AddToCartButton
          product={product}
          quantity={clampedQuantity}
          buttonVariant="rj"
          className="w-full sm:w-auto"
          sellerName={shopName}
          variant={variantInfo}
        />
        <BuyNowButton
          product={product}
          quantity={clampedQuantity}
          className="w-full sm:w-auto"
          sellerName={shopName}
          variant={variantInfo}
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
