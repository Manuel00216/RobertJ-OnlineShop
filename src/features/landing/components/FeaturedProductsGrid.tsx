"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

import { ROUTES } from "@/constants/routes";
import { useReveal } from "@/features/landing/hooks/useReveal";
import { PRODUCT_FILTERS } from "@/features/landing/constants/landing.constants";
import { ProductTile, type ProductTileItem } from "@/features/products/components/ProductTile";
import type { FeaturedProductView } from "@/features/landing/types/landing.types";

export interface FeaturedProductsGridProps {
  products: FeaturedProductView[];
  /** Ids of the current user's saved products; empty for a guest. */
  wishlistedProductIds?: readonly string[];
  isAuthenticated?: boolean;
}

function toTileItem(
  view: FeaturedProductView,
  wishlistedIds: ReadonlySet<string>,
  isAuthenticated: boolean,
): ProductTileItem {
  return {
    key: view.key,
    name: view.name,
    shopName: view.shop,
    priceCents: view.priceCents,
    originalPriceCents: view.originalPriceCents,
    currency: view.currency,
    imageUrl: view.imageUrl,
    href: view.href,
    isNew: view.isNew,
    isSale: view.isSale,
    conditionLabel: null,
    maxQuantity: view.productId ? view.maxQuantity : null,
    addToCart:
      view.productId && view.slug && view.sellerId
        ? {
            productId: view.productId,
            slug: view.slug,
            sellerId: view.sellerId,
            // Marketing quick-add has no seller name; checkout falls back to "Seller".
            sellerName: null,
          }
        : null,
    // Placeholders (no productId yet) never show a wishlist heart — there is
    // nothing real to save.
    wishlist: view.productId
      ? {
          productId: view.productId,
          initialSaved: wishlistedIds.has(view.productId),
          isAuthenticated,
        }
      : null,
  };
}

export function FeaturedProductsGrid({
  products,
  wishlistedProductIds = [],
  isAuthenticated = false,
}: FeaturedProductsGridProps) {
  const wishlistedIds = useMemo(
    () => new Set(wishlistedProductIds),
    [wishlistedProductIds],
  );
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const { ref: gridRef, inView } = useReveal<HTMLDivElement>({ amount: 0.1 });

  const filtered = useMemo(() => {
    if (activeFilter === "All") return products;
    if (activeFilter === "Sale") return products.filter((p) => p.isSale);
    return products.filter((p) => p.category === activeFilter);
  }, [activeFilter, products]);

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
        {filtered.map((item, i) => (
          <ProductTile
            key={item.key}
            item={toTileItem(item, wishlistedIds, isAuthenticated)}
            style={{
              animation: inView ? `fadeSlideIn 0.5s ease ${i * 60}ms both` : "none",
            }}
          />
        ))}
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
