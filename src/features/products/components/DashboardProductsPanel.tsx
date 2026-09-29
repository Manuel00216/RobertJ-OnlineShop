import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import type { RecommendationRule } from "@/features/assistant";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { ProductsDataTable } from "@/features/products/components/ProductsDataTable";
import { dashboardProductListParamsSchema } from "@/features/products/schemas/product.schema";
import type { Category } from "@/features/categories/types/category.types";
import type { Product, ProductVariant } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";
import {
  listActiveCategories,
  listDashboardProductVariants,
  listDashboardProductsPage,
  listDashboardRecommendationRules,
} from "@/lib/supabase/queries";
import type { PaginatedResult } from "@/types/pagination.types";

export interface DashboardProductsPanelProps {
  searchParams: Record<string, string | string[] | undefined>;
  /** `null` for an admin (no ownership filter — RLS + moderation scope only); the caller's own seller/shop id otherwise. */
  owner: { sellerId: string; shopId: string | null } | null;
  /** Populated only for an admin (from `listShops()`); empty for a seller. */
  shops: Shop[];
  isAdmin: boolean;
}

/**
 * Dashboard equivalent of `ProductListSection` (the buyer catalog) — reads
 * its own `searchParams` and fetches a paginated/filtered page of products
 * directly, rather than the page pre-fetching everything and passing it
 * down. Mirrors `DashboardOrdersPanel`'s exact shape.
 */
export async function DashboardProductsPanel({
  searchParams,
  owner,
  shops,
  isAdmin,
}: DashboardProductsPanelProps) {
  const parsed = dashboardProductListParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return <ErrorState message="Those filters aren't valid. Try clearing your search." />;
  }

  let data: {
    result: PaginatedResult<Product>;
    categories: Category[];
    variants: ProductVariant[];
    rules: RecommendationRule[];
  };
  try {
    const [result, categories, variants, rules] = await Promise.all([
      listDashboardProductsPage(owner, parsed.data),
      listActiveCategories(),
      listDashboardProductVariants(),
      listDashboardRecommendationRules(),
    ]);
    data = { result, categories, variants, rules };
  } catch {
    return <ErrorState message="We couldn't load products right now." />;
  }

  const { result, categories, variants, rules } = data;
  const { items, page, totalPages, total } = result;

  if (items.length === 0) {
    const filtering = Boolean(parsed.data.search || parsed.data.status || parsed.data.categoryId);
    return (
      <EmptyState
        title={filtering ? "No matching products" : "No products yet"}
        description={
          filtering
            ? "Try a different search term or clear a filter."
            : "Create your first product to get started."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total} product{total === 1 ? "" : "s"}
      </p>
      <ProductsDataTable
        products={items}
        categories={categories}
        shops={shops}
        isAdmin={isAdmin}
        variants={variants}
        rules={rules}
      />
      {totalPages > 1 ? <PaginationControls page={page} totalPages={totalPages} themed /> : null}
    </div>
  );
}
