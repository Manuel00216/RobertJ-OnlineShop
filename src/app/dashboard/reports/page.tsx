import { Suspense } from "react";
import type { Metadata } from "next";

import { USER_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import {
  ExportReportButton,
  LowStockPanel,
  OrderStatusPanel,
  parseReportFilters,
  ReportCardSkeleton,
  ReportsFilters,
  SalesSummaryPanel,
  SalesSummarySkeleton,
  SalesTrendPanel,
  TopProductsPanel,
  type ReportShopOption,
} from "@/features/reports";
import { listShops, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Reports — Dashboard" };

interface DashboardReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardReportsPage({
  searchParams,
}: DashboardReportsPageProps) {
  const params = await searchParams;
  const user = await requireSessionUser();
  const isAdmin = user.role === USER_ROLES.admin;
  const filters = parseReportFilters(params, { isAdmin });

  // Admins can narrow to one shop; sellers only ever see their own.
  let shops: ReportShopOption[] | undefined;
  if (isAdmin) {
    try {
      shops = (await listShops()).map((shop) => ({ id: shop.id, name: shop.name }));
    } catch {
      shops = undefined;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <CatalogHeader
          eyebrow="Dashboard"
          title="Reports"
          description={
            isAdmin
              ? "Sales and performance analytics across every shop."
              : "Sales and performance analytics for your shop."
          }
        />
        <ExportReportButton filters={filters} />
      </div>

      <ReportsFilters filters={filters} isAdmin={isAdmin} shops={shops} />

      {/* Keyed so changing filters restarts every panel's suspense boundary. */}
      <div key={JSON.stringify(filters)} className="flex flex-col gap-6">
        <Suspense fallback={<SalesSummarySkeleton />}>
          <SalesSummaryPanel filters={filters} />
        </Suspense>

        <Suspense fallback={<ReportCardSkeleton />}>
          <SalesTrendPanel filters={filters} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ReportCardSkeleton />}>
            <OrderStatusPanel filters={filters} />
          </Suspense>
          <Suspense fallback={<ReportCardSkeleton />}>
            <TopProductsPanel filters={filters} />
          </Suspense>
        </div>

        <Suspense fallback={<ReportCardSkeleton />}>
          <LowStockPanel showShop={isAdmin} />
        </Suspense>
      </div>
    </div>
  );
}
