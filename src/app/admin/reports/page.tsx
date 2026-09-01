import { Suspense } from "react";
import type { Metadata } from "next";

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
import { listShops } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Reports — Admin Portal" };

interface AdminReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const params = await searchParams;
  const filters = parseReportFilters(params, { isAdmin: true });

  let shops: ReportShopOption[] | undefined;
  try {
    shops = (await listShops()).map((shop) => ({ id: shop.id, name: shop.name }));
  } catch {
    shops = undefined;
  }

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <div className="flex justify-end">
        <ExportReportButton filters={filters} />
      </div>

      <ReportsFilters filters={filters} isAdmin shops={shops} />

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
          <LowStockPanel showShop />
        </Suspense>
      </div>
    </div>
  );
}
