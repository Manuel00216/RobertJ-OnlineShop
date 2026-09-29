"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Category } from "@/features/categories/types/category.types";

export interface DashboardCategoryFilterProps {
  categories: Category[];
}

/** Category dropdown for the Products dashboard table — sets `categoryId`, always clears `page`. */
export function DashboardCategoryFilter({ categories }: DashboardCategoryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategoryId = searchParams.get("categoryId") ?? "";

  function updateParams(categoryId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) params.set("categoryId", categoryId);
    else params.delete("categoryId");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={activeCategoryId}
      onChange={(event) => updateParams(event.target.value)}
      aria-label="Filter by category"
      className="h-9 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <option value="">All categories</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
