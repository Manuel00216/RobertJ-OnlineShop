"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Category } from "@/features/categories/types/category.types";
import type { ProductSort } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";

export interface ProductFiltersProps {
  /**
   * Category chips. Pass an empty array/omit to hide the chip row (used on
   * pinned category pages where the category is fixed server-side).
   */
  categories?: Category[];
  /** Shop dropdown options. Pass an empty array/omit to hide it. */
  shops?: Shop[];
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

/** Category chips + shop + price range + sort control for the product listing. */
export function ProductFilters({ categories = [], shops = [] }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategoryId = searchParams.get("categoryId") ?? "";
  const activeShopId = searchParams.get("shopId") ?? "";
  const rawSort = searchParams.get("sort");
  const sort: ProductSort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as ProductSort)
    : "newest";
  const onSale = searchParams.get("onSale") === "true";

  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const debouncedMinPrice = useDebouncedValue(minPrice, 400);
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 400);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Push the debounced price values to the URL once they settle, so a drag/
  // keystroke doesn't trigger a navigation per tick (mirrors ProductSearchInput's
  // inline-params pattern, not the shared `updateParams` closure, so the effect's
  // dependency list stays exact).
  useEffect(() => {
    const current = searchParams.get("minPrice") ?? "";
    if (current === debouncedMinPrice) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedMinPrice) params.set("minPrice", debouncedMinPrice);
    else params.delete("minPrice");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedMinPrice, pathname, router, searchParams]);

  useEffect(() => {
    const current = searchParams.get("maxPrice") ?? "";
    if (current === debouncedMaxPrice) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedMaxPrice) params.set("maxPrice", debouncedMaxPrice);
    else params.delete("maxPrice");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedMaxPrice, pathname, router, searchParams]);

  function resetPrice() {
    setMinPrice("");
    setMaxPrice("");
    updateParams({ minPrice: null, maxPrice: null });
  }

  const hasPriceFilter = minPrice !== "" || maxPrice !== "";

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={onSale}
          onClick={() => updateParams({ onSale: onSale ? null : "true" })}
          className={onSale ? CHIP_ACTIVE : CHIP_IDLE}
        >
          On Sale
        </button>

        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by price">
          <label htmlFor="filter-min-price" className="sr-only">
            Minimum price
          </label>
          <input
            id="filter-min-price"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Min ₱"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="h-9 w-20 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-3 text-[11px] font-bold text-rj-black outline-none transition-colors placeholder:text-rj-gray-400 placeholder:font-medium focus-visible:border-rj-black"
          />
          <span className="text-rj-gray-400" aria-hidden="true">
            –
          </span>
          <label htmlFor="filter-max-price" className="sr-only">
            Maximum price
          </label>
          <input
            id="filter-max-price"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Max ₱"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="h-9 w-20 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-3 text-[11px] font-bold text-rj-black outline-none transition-colors placeholder:text-rj-gray-400 placeholder:font-medium focus-visible:border-rj-black"
          />
          {hasPriceFilter ? (
            <button
              type="button"
              onClick={resetPrice}
              className="text-[11px] font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
            >
              Reset
            </button>
          ) : null}
        </div>

        {shops.length > 0 ? (
          <select
            value={activeShopId}
            onChange={(event) => updateParams({ shopId: event.target.value || null })}
            aria-label="Filter by shop"
            className="h-9 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-3 text-[11px] font-bold text-rj-black outline-none transition-colors focus-visible:border-rj-black"
          >
            <option value="">All shops</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
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
    </div>
  );
}
