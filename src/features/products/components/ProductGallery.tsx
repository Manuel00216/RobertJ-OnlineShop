"use client";

import Image from "next/image";
import { useState } from "react";

import type { ProductImage } from "@/features/products/types/product.types";

export interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
}

/** Main image + thumbnail switcher (frozen-consistent rj styling). */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  return (
    <div role="group" aria-label="Product images">
      <div className="relative mb-3 aspect-[3/4] overflow-hidden rounded-xl bg-rj-gray-100">
        {active ? (
          <Image
            src={active.url}
            alt={active.altText ?? title}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-rj-gray-400">
            No image available
          </span>
        )}
      </div>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Product image thumbnails">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              aria-label={`View image ${index + 1}`}
              className={`relative aspect-[3/4] w-16 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 ${
                index === activeIndex
                  ? "border-rj-black"
                  : "border-rj-gray-200 hover:border-rj-gray-400"
              }`}
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${title} ${index + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
