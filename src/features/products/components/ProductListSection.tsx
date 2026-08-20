import { ErrorState } from "@/components/feedback/ErrorState";
import { listProducts } from "@/lib/supabase/queries";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { productListParamsSchema } from "@/features/products/schemas/product.schema";
import type {
  Product,
  ProductListParams,
} from "@/features/products/types/product.types";
import type { PaginatedResult } from "@/types/pagination.types";

export interface ProductListSectionProps {
  searchParams: Record<string, string | string[] | undefined>;
  /** Pinned category (e.g. /categories/[slug]). Overrides any URL `categoryId`. */
  categoryId?: string;
}

/**
 * Server Component that owns data loading for the product listing.
 * Keeping the fetch here lets the page stream a skeleton while it resolves.
 * A pinned `categoryId` (category pages) wins over the URL, so the listing
 * always filters by exactly one resolved category.
 */
export async function ProductListSection({
  searchParams,
  categoryId,
}: ProductListSectionProps) {
  const parsed = productListParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return (
      <ErrorState message="Those filters aren't valid. Try clearing your search." />
    );
  }

  const params: ProductListParams = {
    ...parsed.data,
    ...(categoryId ? { categoryId } : {}),
  };

  let result: PaginatedResult<Product>;
  try {
    result = await listProducts(params);
  } catch {
    return (
      <ErrorState message="We couldn't load products right now." />
    );
  }

  const { items, page, totalPages, total } = result;
  const viewMode = searchParams.view === "list" ? "list" : "grid";

  return (
    <section className="flex flex-col gap-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400" aria-live="polite">
        {total} product{total === 1 ? "" : "s"}
      </p>
      <ProductGrid products={items} viewMode={viewMode} searchTerm={parsed.data.search} />
      {totalPages > 1 ? <PaginationControls page={page} totalPages={totalPages} /> : null}
    </section>
  );
}
