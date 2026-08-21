import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { manilaToday } from "@/features/reports/utils/report-range";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getDashboardOrderSummary,
  getLowStockReport,
  getOwnShopId,
  getSalesSummary,
  listDashboardProducts,
  listPendingPayments,
  requireSessionUser,
} from "@/lib/supabase/queries";

function StatTile({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full border-rj-gray-100 transition-colors hover:border-rj-black">
        <CardContent className="flex flex-col gap-1 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-400">
            {label}
          </p>
          <p className="truncate font-serif text-xl leading-tight tabular-nums text-rj-black sm:text-2xl">
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * "What's happening in my shop right now" — six clickable KPI tiles, each
 * reused directly from an already-built data source (Reports' summary RPC,
 * the dashboard order-status counts, Inventory's low-stock report, and the
 * same pending-payments query the old standalone card used). No new RPC, no
 * new table.
 */
export async function DashboardKpiRow() {
  let today: Awaited<ReturnType<typeof getSalesSummary>>;
  let pendingOrders: number;
  let totalProducts: number;
  let lowStockCount: number;
  let pendingPayments: number;

  try {
    const user = await requireSessionUser();
    const isAdmin = user.role === USER_ROLES.admin;
    const owner = isAdmin ? null : { sellerId: user.id, shopId: await getOwnShopId(user.id) };

    const manila = manilaToday();
    const [summary, orderSummary, products, lowStock, payments] = await Promise.all([
      getSalesSummary(manila, manila, null),
      getDashboardOrderSummary(),
      listDashboardProducts(owner),
      getLowStockReport(),
      listPendingPayments(),
    ]);
    today = summary;
    pendingOrders = orderSummary.statusCounts.pending;
    totalProducts = products.length;
    lowStockCount = lowStock.length;
    pendingPayments = payments.length;
  } catch {
    return <ErrorState message="We couldn't load your shop's overview right now." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        href={ROUTES.reports}
        label="Today's sales"
        value={formatCurrency(today.revenueCents)}
      />
      <StatTile href={ROUTES.dashboardOrders} label="Today's orders" value={today.totalOrders} />
      <StatTile href={ROUTES.dashboardOrders} label="Pending orders" value={pendingOrders} />
      <StatTile href={ROUTES.dashboardProducts} label="Products" value={totalProducts} />
      <StatTile href={ROUTES.inventory} label="Low stock" value={lowStockCount} />
      <StatTile
        href={ROUTES.paymentVerification}
        label="Pending payments"
        value={pendingPayments}
      />
    </div>
  );
}

export function DashboardKpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-rj-gray-100">
          <CardContent className="flex flex-col gap-2 p-5">
            <Skeleton className="h-3 w-16 bg-rj-gray-100" />
            <Skeleton className="h-7 w-20 bg-rj-gray-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
