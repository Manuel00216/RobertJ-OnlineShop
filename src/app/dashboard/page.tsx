import { Suspense } from "react";
import type { Metadata } from "next";

import type { UserRole } from "@/constants/roles";
import { DashboardKpiRow, DashboardKpiRowSkeleton } from "@/features/dashboard/components/DashboardKpiRow";
import { DashboardShortcuts } from "@/features/dashboard/components/DashboardShortcuts";
import { LowStockCard, LowStockCardSkeleton } from "@/features/dashboard/components/LowStockCard";
import { RecentOrdersCard, RecentOrdersCardSkeleton } from "@/features/dashboard/components/RecentOrdersCard";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverviewPage() {
  const user = await requireSessionUser();
  const role = user.role as UserRole;

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title={`Welcome back${user.fullName ? `, ${user.fullName}` : ""}`}
        description="Here's what's happening with your shop today."
      />

      <Suspense fallback={<DashboardKpiRowSkeleton />}>
        <DashboardKpiRow />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<RecentOrdersCardSkeleton />}>
          <RecentOrdersCard />
        </Suspense>
        <Suspense fallback={<LowStockCardSkeleton />}>
          <LowStockCard />
        </Suspense>
      </div>

      <DashboardShortcuts role={role} />
    </div>
  );
}
