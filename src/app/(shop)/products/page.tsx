import { Suspense } from "react";
import type { Metadata } from "next";

import { listActiveCategories, listShops } from "@/lib/supabase/queries";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ProductFilters } from "@/features/products/components/ProductFilters";
import { ProductGridSkeleton } from "@/features/products/components/ProductGridSkeleton";
import { ProductListSection } from "@/features/products/components/ProductListSection";
import { ProductSearchInput } from "@/features/products/components/ProductSearchInput";

export const metadata: Metadata = { title: "Products" };

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  // Categories feed the filter chips, shops feed the shop dropdown; a fetch
  // failure just hides that control rather than breaking the page.
  const [categories, shops] = await Promise.all([
    listActiveCategories().catch(() => []),
    listShops().catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="The Collection"
        title="Products"
        description="Everything currently available on the marketplace."
      />

      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <ProductSearchInput />
        </Suspense>
        <Suspense fallback={null}>
          <ProductFilters categories={categories} shops={shops} />
        </Suspense>
      </div>

      {/* Keyed so a new search restarts the suspense boundary. */}
      <Suspense key={JSON.stringify(params)} fallback={<ProductGridSkeleton />}>
        <ProductListSection searchParams={params} />
      </Suspense>
    </div>
  );
}
