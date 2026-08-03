import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import type { Category } from "@/features/categories/types/category.types";

export interface CategoryCardProps {
  category: Category;
}

/** rj category tile, mirroring the landing's category bento cards. */
export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={ROUTES.categoryDetail(category.slug)}
      className="group relative block overflow-hidden rounded-2xl bg-rj-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
      style={{ aspectRatio: "3 / 4" }}
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt={category.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
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
        <p className="text-[10px] font-medium tracking-widest text-rj-gray-400">
          {category.productCount.toLocaleString("en-US")} item(s)
        </p>
        <h3 className="font-serif text-2xl text-rj-white transition-colors group-hover:text-rj-red">
          {category.name}
        </h3>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-rj-white opacity-0 transition-all group-hover:opacity-100">
          Shop now <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
