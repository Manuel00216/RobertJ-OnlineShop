"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import { useReveal } from "@/features/landing/hooks/useReveal";
import { PRODUCT_FILTERS } from "@/features/landing/constants/landing.constants";
import type { FeaturedProductView } from "@/features/landing/types/landing.types";

/** Whole-peso formatting to match the design (no trailing decimals). */
function formatPeso(cents: number) {
  return `₱${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** Matches ProductCard's threshold — see its comment for why. Placeholders
 * (productId === null) never trigger stock badges; only real products do. */
const LOW_STOCK_THRESHOLD = 5;

export interface FeaturedProductsGridProps {
  products: FeaturedProductView[];
}

export function FeaturedProductsGrid({ products }: FeaturedProductsGridProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const { ref: gridRef, inView } = useReveal<HTMLDivElement>({ amount: 0.1 });

  const filtered = useMemo(() => {
    if (activeFilter === "All") return products;
    if (activeFilter === "Sale") return products.filter((p) => p.isSale);
    return products.filter((p) => p.category === activeFilter);
  }, [activeFilter, products]);

  function handleQuickAdd(item: FeaturedProductView) {
    if (!item.productId || !item.sellerId) {
      router.push(ROUTES.products);
      return;
    }
    // Guard against the cart reducer's clampQuantity flooring to 1 even when
    // maxQuantity is 0 — without this, a sold-out featured product could be
    // silently added with quantity 1.
    if (item.maxQuantity <= 0) return;
    addItem({
      productId: item.productId,
      slug: item.slug ?? "",
      title: item.name,
      imageUrl: item.imageUrl,
      unitPriceCents: item.priceCents,
      currency: item.currency,
      quantity: 1,
      maxQuantity: item.maxQuantity,
      sellerId: item.sellerId,
      // Marketing quick-add has no seller name; checkout falls back to "Seller".
      sellerName: null,
    });
    setAddedKey(item.key);
    window.setTimeout(() => setAddedKey(null), 2000);
  }

  return (
    <>
      {/* Header row: heading left, filter chips right (design layout) */}
      <div className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red">
            Featured Products
          </p>
          <h2 className="font-serif text-4xl leading-[1.05] text-rj-black md:text-[52px]">
            Picked for You
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border-[1.5px] px-4 py-1.5 text-[11px] font-bold transition-all ${
                activeFilter === filter
                  ? "border-rj-black bg-rj-black text-rj-white"
                  : "border-rj-gray-200 bg-transparent text-rj-gray-600 hover:border-rj-black hover:text-rj-black"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
      >
        {filtered.map((item, i) => {
          const discount =
            item.isSale && item.originalPriceCents
              ? Math.round((1 - item.priceCents / item.originalPriceCents) * 100)
              : null;
          const isAdded = addedKey === item.key;
          // Placeholders (productId === null) have maxQuantity 0 by convention
          // but aren't real stock — only gate on it for real products.
          const isRealProduct = item.productId !== null;
          const isOutOfStock = isRealProduct && item.maxQuantity <= 0;
          const isLowStock =
            isRealProduct && !isOutOfStock && item.maxQuantity <= LOW_STOCK_THRESHOLD;

          return (
            <div
              key={item.key}
              className="group"
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                animation: inView ? `fadeSlideIn 0.5s ease ${i * 60}ms both` : "none",
              }}
            >
              <div
                className="relative mb-3 overflow-hidden rounded-xl bg-rj-gray-100"
                style={{ aspectRatio: "3 / 4" }}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-rj-black/0 transition-colors group-hover:bg-rj-black/10" />

                {/* Badges */}
                <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                  {isOutOfStock ? (
                    <span className="rounded-full bg-rj-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rj-white">
                      Sold out
                    </span>
                  ) : (
                    <>
                      {item.isNew ? (
                        <span className="rounded-full bg-rj-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rj-white">
                          New
                        </span>
                      ) : null}
                      {item.isSale ? (
                        <span className="rounded-full bg-rj-red px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          Sale
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                {discount !== null ? (
                  <div className="absolute right-3 top-3 rounded-full bg-rj-white px-2 py-0.5 text-[9px] font-black text-rj-red">
                    -{discount}%
                  </div>
                ) : null}

                {/* Quick add — hidden for real, sold-out products; the marketing
                    placeholder path always routes to the catalog instead. */}
                {!isOutOfStock ? (
                  <div
                    className={`absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ${
                      hoveredKey === item.key
                        ? "translate-y-0 opacity-100"
                        : "translate-y-3 opacity-0"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(item)}
                      className="w-full rounded-full bg-rj-white/95 py-2.5 text-[11px] font-bold text-rj-black backdrop-blur-sm transition-colors hover:bg-rj-red hover:text-white"
                    >
                      <span aria-live="polite">{isAdded ? "Added to Cart" : "+ Add to Cart"}</span>
                    </button>
                  </div>
                ) : null}
              </div>

              <Link href={item.href} className="block">
                <div className="mb-0.5 text-[9px] font-medium tracking-widest text-rj-gray-400">
                  {item.shop}
                </div>
                <h4 className="mb-1 text-[13px] font-medium leading-snug text-rj-black">
                  {item.name}
                </h4>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[14px] font-bold text-rj-black">
                    {formatPeso(item.priceCents)}
                  </span>
                  {item.originalPriceCents ? (
                    <span className="text-[11px] text-rj-gray-400 line-through">
                      {formatPeso(item.originalPriceCents)}
                    </span>
                  ) : null}
                  {isLowStock ? (
                    <span className="text-[10px] font-bold text-rj-gold">
                      Only {item.maxQuantity} left
                    </span>
                  ) : null}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-14 text-center">
        <Link
          href={ROUTES.products}
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-rj-black px-8 py-3.5 text-[13px] font-bold text-rj-black transition-colors hover:bg-rj-black hover:text-rj-white"
        >
          View All Products
          <ArrowRight className="h-[13px] w-[13px]" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
