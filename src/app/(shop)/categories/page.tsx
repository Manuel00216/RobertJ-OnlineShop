import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/ErrorState";
import { listActiveCategories } from "@/lib/supabase/queries";
import { CategoryGrid } from "@/features/categories/components/CategoryGrid";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import type { Category } from "@/features/categories/types/category.types";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  let categories: Category[] = [];
  let loadError = false;
  try {
    categories = await listActiveCategories();
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-10">
      <CatalogHeader
        eyebrow="The Index"
        title="Shop by Category"
        description="Every category with active listings."
      />
      {loadError ? (
        <ErrorState message="We couldn't load categories right now." />
      ) : (
        <CategoryGrid categories={categories} />
      )}
    </div>
  );
}
