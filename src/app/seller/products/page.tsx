import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardProductsPanel } from "@/features/products/components/DashboardProductsPanel";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import {
  getOwnShopId,
  listActiveCategories,
  listDashboardProducts,
  requireSessionUser,
} from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Products — Seller Portal" };

async function SellerProductsData() {
  const user = await requireSessionUser();
  const owner = { sellerId: user.id, shopId: await getOwnShopId(user.id) };
  const [products, categories] = await Promise.all([
    listDashboardProducts(owner),
    listActiveCategories(),
  ]);

  return (
    <DashboardProductsPanel products={products} categories={categories} shops={[]} isAdmin={false} />
  );
}

export default function SellerProductsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<DashboardRowsSkeleton label="Loading products" />}>
        <SellerProductsData />
      </Suspense>
    </div>
  );
}
