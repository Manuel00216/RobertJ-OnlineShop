import type { Metadata } from "next";

import { USER_ROLES } from "@/constants/roles";
import { DashboardProductsPanel } from "@/features/products/components/DashboardProductsPanel";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { listActiveCategories, listDashboardProducts, listShops, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Products — Dashboard" };

export default async function DashboardProductsPage() {
  const user = await requireSessionUser();
  const isAdmin = user.role === USER_ROLES.admin;

  const [products, categories, shops] = await Promise.all([
    listDashboardProducts(),
    listActiveCategories(),
    isAdmin ? listShops() : Promise.resolve([]),
  ]);

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
      <DashboardProductsPanel
        products={products}
        categories={categories}
        shops={shops}
        isAdmin={isAdmin}
      />
    </div>
  );
}
