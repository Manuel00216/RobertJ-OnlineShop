"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useRef } from "react";

import { ROUTES } from "@/constants/routes";
import { useReveal } from "@/features/landing/hooks/useReveal";
import type { FeaturedShop } from "@/features/landing/types/landing.types";

const BADGE_STYLES: Record<NonNullable<FeaturedShop["badge"]>, string> = {
  "Top Seller": "bg-rj-gold text-rj-black",
  "New Shop": "bg-rj-green text-white",
  Featured: "bg-rj-red text-white",
};

export interface FeaturedShopsProps {
  shops: FeaturedShop[];
}

/**
 * Horizontally scrollable "top sellers" carousel. Data is placeholder for now
 * (no shop entity in the schema); the component accepts `FeaturedShop[]` so it
 * can be fed a real service later without changes.
 */
export function FeaturedShops({ shops }: FeaturedShopsProps) {
  const { ref: headerRef, inView } = useReveal<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

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
              Top Sellers
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
              className="group w-[260px] flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
              style={{
                scrollSnapAlign: "start",
                animation: inView ? `fadeSlideIn 0.6s ease ${i * 80}ms both` : "none",
              }}
            >
              <div className="relative h-44 overflow-hidden bg-rj-gray-50">
                <Image
                  src={shop.imageUrl}
                  alt={shop.name}
                  fill
                  sizes="260px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-rj-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                {shop.badge ? (
                  <div
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${BADGE_STYLES[shop.badge]}`}
                  >
                    {shop.badge}
                  </div>
                ) : null}
              </div>
              <div className="p-4">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-rj-gray-400">
                  {shop.category}
                </div>
                <h3 className="mb-2 text-[15px] font-semibold text-rj-black">{shop.name}</h3>
                <div className="mb-3 flex items-center gap-1 text-[11px] text-rj-gray-400">
                  <Star className="h-[11px] w-[11px] fill-rj-gold text-rj-gold" aria-hidden="true" />
                  <span className="font-semibold text-rj-black">{shop.rating}</span>
                  <span>· {shop.productCount} items</span>
                </div>
                <Link
                  href={ROUTES.products}
                  className="block w-full rounded-full border-[1.5px] border-rj-black py-2 text-center text-[12px] font-bold text-rj-black transition-colors hover:bg-rj-black hover:text-rj-white"
                >
                  Visit Shop
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
