import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { USER_ROLES, type UserRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { DashboardDateFilter } from "@/features/dashboard/components/DashboardDateFilter";
import { DashboardKpiRow, DashboardKpiRowSkeleton } from "@/features/dashboard/components/DashboardKpiRow";
import { DashboardShortcuts } from "@/features/dashboard/components/DashboardShortcuts";
import { LowStockCard, LowStockCardSkeleton } from "@/features/dashboard/components/LowStockCard";
import { RecentOrdersCard, RecentOrdersCardSkeleton } from "@/features/dashboard/components/RecentOrdersCard";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { parseDashboardDateRange } from "@/features/reports/utils/report-range";
import { requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardOverviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardOverviewPage({
  searchParams,
}: DashboardOverviewPageProps) {
  const user = await requireSessionUser();
  const role = user.role as UserRole;
  if (role === USER_ROLES.admin) {
    redirect(ROUTES.adminDashboard);
  }
  const params = await searchParams;
  const { from, to } = parseDashboardDateRange(params);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title={`Welcome back${user.fullName ? `, ${user.fullName}` : ""}`}
        description="Here's what's happening with your shop."
      />

      <DashboardDateFilter from={from} to={to} />

      <Suspense key={`${from}:${to}`} fallback={<DashboardKpiRowSkeleton />}>
        <DashboardKpiRow from={from} to={to} />
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
