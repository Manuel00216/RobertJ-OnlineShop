import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { InventoryTable } from "@/features/inventory/components/InventoryTable";
import { listDashboardInventory } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Inventory — Seller Portal" };

async function SellerInventoryData() {
  const items = await listDashboardInventory();
  return <InventoryTable items={items} isAdmin={false} />;
}

export default function SellerInventoryPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<DashboardRowsSkeleton label="Loading inventory" />}>
        <SellerInventoryData />
      </Suspense>
    </div>
  );
}
