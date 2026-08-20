"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";

import { ROUTES } from "@/constants/routes";
import { useReveal } from "@/features/landing/hooks/useReveal";
import type { FeaturedShop } from "@/features/landing/types/landing.types";

export interface FeaturedShopsCarouselProps {
  shops: FeaturedShop[];
}

/**
 * Horizontally scrollable "top sellers" carousel. Presentational only — data
 * (real shops + a real active-product count, no fabricated rating/badge/cover
 * image) is fetched by the `FeaturedShops` server wrapper, same split as
 * `FeaturedProducts`/`FeaturedProductsGrid`.
 */
export function FeaturedShopsCarousel({ shops }: FeaturedShopsCarouselProps) {
  const { ref: headerRef, inView } = useReveal<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  if (shops.length === 0) return null;

  return (
    <section id="shops" className="bg-rj-white py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div
          ref={headerRef}
          className={`mb-12 flex items-end justify-between transition-all duration-700 ${
            inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red">
              Featured Shops
            </p>
            <h2 className="font-serif text-4xl leading-[1.05] text-rj-black md:text-[52px]">
              Discover Our
              <br />
              Sibling Shops
            </h2>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll shops left"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rj-gray-200 text-rj-gray-600 transition-all hover:border-rj-black hover:bg-rj-black hover:text-rj-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll shops right"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rj-gray-200 text-rj-gray-600 transition-all hover:border-rj-black hover:bg-rj-black hover:text-rj-white"
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <Link
              href={ROUTES.products}
              className="ml-2 flex items-center gap-1 text-[13px] font-medium text-rj-gray-600 transition-colors hover:text-rj-black"
            >
              All shops <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-3"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {shops.map((shop, i) => (
            <article
              key={shop.id}
              className="group w-[220px] flex-shrink-0 overflow-hidden rounded-2xl border border-rj-gray-100 bg-white p-5 text-center transition-all duration-300 hover:shadow-xl"
              style={{
                scrollSnapAlign: "start",
                animation: inView ? `fadeSlideIn 0.6s ease ${i * 80}ms both` : "none",
              }}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rj-black text-xl font-bold text-rj-white">
                {shop.name.slice(0, 1).toUpperCase()}
              </div>
              <h3 className="mb-1 text-[15px] font-semibold text-rj-black">
                {shop.name}
              </h3>
              <p className="mb-4 text-[11px] text-rj-gray-400">
                {shop.productCount} product{shop.productCount === 1 ? "" : "s"}
              </p>
              <Link
                href={`${ROUTES.products}?shopId=${shop.id}`}
                className="block w-full rounded-full border-[1.5px] border-rj-black py-2 text-center text-[12px] font-bold text-rj-black transition-colors hover:bg-rj-black hover:text-rj-white"
              >
                Visit Shop
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
