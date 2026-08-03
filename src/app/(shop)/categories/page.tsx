import type { Metadata } from "next";

import { listActiveCategories } from "@/lib/supabase/queries";
import { CategoryGrid } from "@/features/categories/components/CategoryGrid";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listActiveCategories().catch(() => []);

  return (
    <div className="flex flex-col gap-10">
      <CatalogHeader
        eyebrow="The Index"
        title="Shop by Category"
        description="Every category with active listings."
      />
      <CategoryGrid categories={categories} />
    </div>
  );
}
