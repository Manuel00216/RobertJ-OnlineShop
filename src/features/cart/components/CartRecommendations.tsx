"use client";

import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { getCartRecommendationsAction } from "@/features/cart/actions/cart.actions";
import { useCart } from "@/features/cart/hooks/useCart";
import { getCoverImage, type Product } from "@/features/products/types/product.types";

/**
 * Restrained "You may also like" strip for the cart page — same-category
 * suggestions (`listCartRecommendations`, the same rule `RelatedProducts`
 * uses on the PDP), not a personalized engine. Deliberately minimal: image,
 * title, price, link only — no shop name, rating, or wishlist button. Those
 * come from the async server-only `ProductGrid`/`ProductTile`, which can't be
 * rendered from a client component; cart contents only exist client-side
 * (ADR-013), so this fetches its own small, purpose-built result instead.
 */
export function CartRecommendations() {
  const { items } = useCart();
  const [products, setProducts] = useState<Product[]>([]);

  const idsKey = useMemo(
    () => [...new Set(items.map((item) => item.productId))].join(","),
    [items],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = idsKey
        ? await getCartRecommendationsAction(idsKey.split(","))
        : { success: true as const, data: [] as Product[] };
      if (!cancelled) setProducts(result.success ? result.data : []);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  if (products.length === 0) return null;

  return (
    <section aria-label="You may also like" className="flex flex-col gap-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        You may also like
      </p>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((product) => {
          const cover = getCoverImage(product);
          return (
            <li key={product.id} className={cn(RJ_CARD, "overflow-hidden")}>
              <Link
                href={ROUTES.productDetail(product.slug)}
                className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
              >
                <span className="relative block aspect-square w-full bg-rj-gray-100">
                  {cover ? (
                    <Image
                      src={cover.url}
                      alt={cover.altText ?? product.title}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-rj-gray-400" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-0.5 p-3">
                  <span className="line-clamp-2 text-sm font-medium text-rj-black">
                    {product.title}
                  </span>
                  <span className="text-sm font-semibold text-rj-black">
                    {formatCurrency(product.priceCents, product.currency)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
