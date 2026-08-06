import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface CategoryTileProps {
  href: string;
  imageUrl: string | null;
  name: string;
  countLabel: string;
  /** Renders as the large bento hero tile (homepage) instead of a uniform card. */
  featured?: boolean;
}

/**
 * Shared visual treatment for a category tile: gradient overlay, hover scale/
 * border, bottom-left name + count + "Shop now" micro-link. Used by both
 * `CategoryCard` (the /categories grid, uniform 3:4 tiles) and
 * `ProductCategories` (the homepage bento grid, one large `featured` tile) so
 * the hover/visual treatment lives in one place instead of two.
 */
export function CategoryTile({ href, imageUrl, name, countLabel, featured = false }: CategoryTileProps) {
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl bg-rj-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 ${
        featured ? "md:col-span-2 md:row-span-2" : ""
      }`}
      style={featured ? { minHeight: 440 } : { aspectRatio: "3 / 4" }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes={
            featured
              ? "(min-width: 768px) 50vw, 50vw"
              : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          }
          className="object-cover opacity-65 transition-all duration-500 group-hover:scale-105 group-hover:opacity-85"
        />
      ) : (
        <div className="absolute inset-0 bg-rj-gray-800" />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-rj-black/85 via-rj-black/20 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 rounded-2xl border-2 border-rj-red/0 transition-colors group-hover:border-rj-red/40"
        aria-hidden="true"
      />
      <div className="absolute bottom-0 left-0 p-5">
        <p className="text-[10px] font-medium tracking-widest text-rj-gray-400">{countLabel}</p>
        <h3 className="font-serif text-2xl text-rj-white transition-colors group-hover:text-rj-red">
          {name}
        </h3>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-rj-white opacity-0 transition-all group-hover:opacity-100">
          Shop now <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
