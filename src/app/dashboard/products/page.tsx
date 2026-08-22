import type { Metadata } from "next";

import { Suspense } from "react";

import { USER_ROLES } from "@/constants/roles";
import { DashboardProductsPanel } from "@/features/products/components/DashboardProductsPanel";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import {
  getOwnShopId,
  listActiveCategories,
  listDashboardProducts,
  listShops,
  requireSessionUser,
} from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Products — Dashboard" };

async function DashboardProductsData({
  owner,
  isAdmin,
}: {
  owner: { sellerId: string; shopId: string | null } | null;
  isAdmin: boolean;
}) {
  const [products, categories, shops] = await Promise.all([
    listDashboardProducts(owner),
    listActiveCategories(),
    isAdmin ? listShops() : Promise.resolve([]),
  ]);

  return (
    <DashboardProductsPanel
      products={products}
      categories={categories}
      shops={shops}
      isAdmin={isAdmin}
    />
  );
}

export default async function DashboardProductsPage() {
  const user = await requireSessionUser();
  const isAdmin = user.role === USER_ROLES.admin;
  const owner = isAdmin ? null : { sellerId: user.id, shopId: await getOwnShopId(user.id) };

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Products"
        description={
          isAdmin
            ? "Manage products across every shop."
            : "Manage your shop's product listings."
        }
      />
      <Suspense fallback={<DashboardRowsSkeleton label="Loading products" />}>
        <DashboardProductsData owner={owner} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
