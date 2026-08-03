import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCategoryBySlug } from "@/lib/supabase/queries";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ProductFilters } from "@/features/products/components/ProductFilters";
import { ProductGridSkeleton } from "@/features/products/components/ProductGridSkeleton";
import { ProductListSection } from "@/features/products/components/ProductListSection";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: category?.name ?? "Category not found" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const [category, sp] = await Promise.all([getCategoryBySlug(slug), searchParams]);

  if (!category) notFound();

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Category"
        title={category.name}
        description={category.description ?? `Browse ${category.name} listings.`}
      />

      {/* Sort-only toolbar — the category is pinned server-side, so no chips. */}
      <Suspense fallback={null}>
        <ProductFilters />
      </Suspense>

      <Suspense key={JSON.stringify(sp)} fallback={<ProductGridSkeleton />}>
        <ProductListSection searchParams={sp} categoryId={category.id} />
      </Suspense>
    </div>
  );
}
