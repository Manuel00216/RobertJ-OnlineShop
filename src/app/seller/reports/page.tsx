import { Suspense } from "react";
import type { Metadata } from "next";

import {
  ExportReportButton,
  LowStockPanel,
  OrderStatusPanel,
  parseReportFilters,
  ReportCardSkeleton,
  RepeatCustomersPanel,
  ReportsFilters,
  RestockPriorityPanel,
  RevenueByCategoryPanel,
  SalesSummarySkeleton,
  SalesTrendPanel,
  TopProductsPanel,
} from "@/features/reports";
import { SellerSalesSummaryPanel } from "@/features/seller/components/SellerSalesSummaryPanel";

export const metadata: Metadata = { title: "Reports — Seller Portal" };

interface SellerReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SellerReportsPage({ searchParams }: SellerReportsPageProps) {
  const params = await searchParams;
  const filters = parseReportFilters(params, { isAdmin: false });

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <div className="flex justify-end">
        <ExportReportButton filters={filters} />
      </div>

      <ReportsFilters filters={filters} isAdmin={false} />

      {/* Keyed so changing filters restarts every panel's suspense boundary. */}
      <div key={JSON.stringify(filters)} className="flex flex-col gap-6">
        <Suspense fallback={<SalesSummarySkeleton />}>
          <SellerSalesSummaryPanel filters={filters} />
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

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ReportCardSkeleton />}>
            <RevenueByCategoryPanel filters={filters} />
          </Suspense>
          <Suspense fallback={<ReportCardSkeleton />}>
            <RepeatCustomersPanel filters={filters} />
          </Suspense>
        </div>

        <Suspense fallback={<ReportCardSkeleton />}>
          <RestockPriorityPanel filters={filters} />
        </Suspense>

        <Suspense fallback={<ReportCardSkeleton />}>
          <LowStockPanel showShop={false} />
        </Suspense>
      </div>
    </div>
  );
}
