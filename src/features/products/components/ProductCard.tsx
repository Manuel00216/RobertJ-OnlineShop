import Image from "next/image";
import Link from "next/link";

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

/** rj editorial product card, matching the landing's product grid language. */
export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.quantity <= 0;
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
        {isOutOfStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-rj-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rj-white">
            Sold out
          </span>
        ) : null}
      </Link>

      <p className="mb-0.5 text-[9px] font-medium tracking-widest text-rj-gray-400">
        {product.sellerName}
      </p>

      <Link
        href={ROUTES.productDetail(product.slug)}
        className="line-clamp-2 text-[13px] font-medium leading-snug text-rj-black hover:underline"
      >
        {product.title}
      </Link>

      <p className="mt-1 text-[14px] font-bold text-rj-black">
        {formatCurrency(product.priceCents, product.currency)}
      </p>

      <AddToCartButton product={product} buttonVariant="rj" className="mt-3 w-full" />
    </article>
  );
}
