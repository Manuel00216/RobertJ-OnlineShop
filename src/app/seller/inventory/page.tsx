import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { DashboardInventorySearchInput } from "@/features/inventory/components/DashboardInventorySearchInput";
import { DashboardStockStatusFilter } from "@/features/inventory/components/DashboardStockStatusFilter";
import { InventoryTable } from "@/features/inventory/components/InventoryTable";

export const metadata: Metadata = { title: "Inventory — Seller Portal" };

interface SellerInventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SellerInventoryPage({ searchParams }: SellerInventoryPageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <DashboardInventorySearchInput />
        </Suspense>
        <Suspense fallback={null}>
          <DashboardStockStatusFilter />
        </Suspense>
      </div>

      {/* Keyed so a new search/filter restarts the suspense boundary. */}
      <Suspense key={JSON.stringify(params)} fallback={<DashboardRowsSkeleton label="Loading inventory" />}>
        <InventoryTable searchParams={params} isAdmin={false} />
      </Suspense>
    </div>
  );
}
