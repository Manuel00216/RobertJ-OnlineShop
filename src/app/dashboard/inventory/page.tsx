import { Suspense } from "react";
import type { Metadata } from "next";

import { USER_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { InventoryTable } from "@/features/inventory/components/InventoryTable";
import { listDashboardInventory, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Inventory — Dashboard" };

async function DashboardInventoryData({ isAdmin }: { isAdmin: boolean }) {
  const items = await listDashboardInventory();
  return <InventoryTable items={items} isAdmin={isAdmin} />;
}

export default async function DashboardInventoryPage() {
  const user = await requireSessionUser();
  const isAdmin = user.role === USER_ROLES.admin;

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Inventory"
        description={
          isAdmin
            ? "Manage stock levels across every shop."
            : "Manage your shop's stock levels."
        }
      />
      <Suspense fallback={<DashboardRowsSkeleton label="Loading inventory" />}>
        <DashboardInventoryData isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
