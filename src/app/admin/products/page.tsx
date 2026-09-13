import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardProductsPanel } from "@/features/products/components/DashboardProductsPanel";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import {
  listActiveCategories,
  listDashboardProducts,
  listDashboardProductVariants,
  listDashboardRecommendationRules,
  listShops,
} from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Products — Admin Portal" };

async function AdminProductsData() {
  const [products, categories, shops, variants, rules] = await Promise.all([
    listDashboardProducts(null),
    listActiveCategories(),
    listShops(),
    listDashboardProductVariants(),
    listDashboardRecommendationRules(),
  ]);

  return (
    <DashboardProductsPanel
      products={products}
      categories={categories}
      shops={shops}
      isAdmin
      variants={variants}
      rules={rules}
    />
  );
}

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<DashboardRowsSkeleton label="Loading products" />}>
        <AdminProductsData />
      </Suspense>
    </div>
  );
}
