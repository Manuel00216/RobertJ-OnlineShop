import { Suspense } from "react";
import type { Metadata } from "next";

import { USER_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { DashboardOrdersPanel } from "@/features/orders/components/DashboardOrdersPanel";
import { OrderSearchInput } from "@/features/orders/components/OrderSearchInput";
import { OrderSkeletons } from "@/features/orders/components/OrderSkeletons";
import { OrderStatusFilter } from "@/features/orders/components/OrderStatusFilter";
import { requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Orders — Dashboard" };

interface DashboardOrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardOrdersPage({
  searchParams,
}: DashboardOrdersPageProps) {
  const params = await searchParams;
  const user = await requireSessionUser();
  const isAdmin = user.role === USER_ROLES.admin;

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Orders"
        description={
          isAdmin
            ? "Fulfil and track orders across every shop."
            : "Fulfil and track your shop's incoming orders."
        }
      />

      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <OrderSearchInput />
        </Suspense>
        <Suspense fallback={null}>
          <OrderStatusFilter />
        </Suspense>
      </div>

      {/* Keyed so a new search/filter restarts the suspense boundary. */}
      <Suspense key={JSON.stringify(params)} fallback={<OrderSkeletons />}>
        <DashboardOrdersPanel searchParams={params} />
      </Suspense>
    </div>
  );
}
