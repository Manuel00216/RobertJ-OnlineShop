import Image from "next/image";
import Link from "next/link";

import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import {
  getCoverImage,
  type Product,
} from "@/features/products/types/product.types";

export interface ProductCardProps {
  product: Product;
}

/** Below this, "Only N left" shows next to the price. Matches the wording in
 * the `create_order` stock-check error ("Only % left of %") for consistency. */
const LOW_STOCK_THRESHOLD = 5;

/** rj editorial product card, matching the landing's product grid language. */
export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.quantity <= 0;
  const isLowStock = !isOutOfStock && product.quantity <= LOW_STOCK_THRESHOLD;
  // "New"/"Sale" are seller-set tags, not fabricated — same convention the
  // homepage's FeaturedProductsGrid already uses, applied consistently here.
  const isNew = product.tags.includes("new");
  const isSale = product.tags.includes("sale");
  const isNotableCondition = product.condition !== PRODUCT_CONDITION.new;
  const cover = getCoverImage(product);

  return (
    <article className="group flex flex-col">
      <Link
        href={ROUTES.productDetail(product.slug)}
        className="relative mb-3 block overflow-hidden rounded-xl bg-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        style={{ aspectRatio: "3 / 4" }}
      >
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.altText ?? product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-rj-gray-400">
            No image
          </span>
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {isOutOfStock ? (
            <span className="rounded-full bg-rj-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rj-white">
              Sold out
            </span>
          ) : (
            <>
              {isNew ? (
                <span className="rounded-full bg-rj-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rj-white">
                  New
                </span>
              ) : null}
              {isSale ? (
                <span className="rounded-full bg-rj-red px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Sale
                </span>
              ) : null}
            </>
          )}
        </div>
      </Link>

      <div className="mb-0.5 flex items-center justify-between gap-2">
        <p className="truncate text-[9px] font-medium tracking-widest text-rj-gray-400">
          {product.sellerName}
        </p>
        {isNotableCondition ? (
          <span className="shrink-0 rounded-full border-[1.5px] border-rj-gray-200 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-rj-gray-600">
            {PRODUCT_CONDITION_LABELS[product.condition]}
          </span>
        ) : null}
      </div>

      <Link
        href={ROUTES.productDetail(product.slug)}
        className="line-clamp-2 text-[13px] font-medium leading-snug text-rj-black hover:underline"
      >
        {product.title}
      </Link>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-bold text-rj-black">
          {formatCurrency(product.priceCents, product.currency)}
        </p>
        {isLowStock ? (
          <span className="shrink-0 text-[10px] font-bold text-rj-gold">
            Only {product.quantity} left
          </span>
        ) : null}
      </div>

      <AddToCartButton product={product} buttonVariant="rj" className="mt-3 w-full" />
    </article>
  );
}
