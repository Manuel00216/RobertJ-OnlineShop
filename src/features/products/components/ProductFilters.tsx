"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Category } from "@/features/categories/types/category.types";
import type { ProductSort } from "@/features/products/types/product.types";

export interface ProductFiltersProps {
  /**
   * Category chips. Pass an empty array/omit to hide the chip row (used on
   * pinned category pages where the category is fixed server-side).
   */
  categories?: Category[];
}

const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "title-asc", label: "Title: A to Z" },
];

const CHIP_ACTIVE =
  "rounded-full border-[1.5px] border-rj-black bg-rj-black px-4 py-1.5 text-[11px] font-bold text-rj-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";
const CHIP_IDLE =
  "rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-4 py-1.5 text-[11px] font-bold text-rj-gray-600 transition-all hover:border-rj-black hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";

/** Category chips + sort control for the product listing. */
export function ProductFilters({ categories = [] }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategoryId = searchParams.get("categoryId") ?? "";
  const rawSort = searchParams.get("sort");
  const sort: ProductSort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as ProductSort)
    : "newest";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={!activeCategoryId}
            className={!activeCategoryId ? CHIP_ACTIVE : CHIP_IDLE}
            onClick={() => updateParams({ categoryId: null })}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={activeCategoryId === category.id}
              className={activeCategoryId === category.id ? CHIP_ACTIVE : CHIP_IDLE}
              onClick={() => updateParams({ categoryId: category.id })}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <select
        value={sort}
        onChange={(event) => updateParams({ sort: event.target.value })}
        aria-label="Sort products"
        className="h-9 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-3 text-[11px] font-bold text-rj-black outline-none transition-colors focus-visible:border-rj-black"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
