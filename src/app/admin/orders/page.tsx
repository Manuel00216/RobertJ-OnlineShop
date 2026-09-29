import { Suspense } from "react";
import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { DashboardOrdersPanel } from "@/features/orders/components/DashboardOrdersPanel";
import { OrderDateFilter } from "@/features/orders/components/OrderDateFilter";
import { OrderMethodFilter } from "@/features/orders/components/OrderMethodFilter";
import { OrderSearchInput } from "@/features/orders/components/OrderSearchInput";
import { OrderSkeletons } from "@/features/orders/components/OrderSkeletons";
import { OrderStatusFilter } from "@/features/orders/components/OrderStatusFilter";

export const metadata: Metadata = { title: "Orders — Admin Portal" };

interface AdminOrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1">
            <Suspense fallback={null}>
              <OrderSearchInput themed />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <OrderMethodFilter />
          </Suspense>
          <Suspense fallback={null}>
            <OrderDateFilter />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <OrderStatusFilter themed />
        </Suspense>
      </div>

      {/* Keyed so a new search/filter restarts the suspense boundary. */}
      <Suspense key={JSON.stringify(params)} fallback={<OrderSkeletons themed />}>
        <DashboardOrdersPanel
          searchParams={params}
          clearFiltersHref={ROUTES.adminOrders}
          isAdmin
        />
      </Suspense>
    </div>
  );
}
