import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CreditCard, Package, ShoppingBag, Timer, TrendingUp } from "lucide-react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
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

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  href: string;
  label: string;
  value: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
        <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
        </div>
        <div className="mb-1 truncate text-2xl font-semibold leading-none tabular-nums text-foreground">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

export interface SellerKpiRowProps {
  from: string;
  to: string;
}

/**
 * Shop-scoped KPI tiles for the Seller Portal dashboard — same data sources
 * as `AdminKpiRow`, but `listDashboardProducts` is scoped to the caller's own
 * shop instead of `null`. `getSalesSummary`/`getDashboardOrderSummary`/
 * `getLowStockReport`/`listPendingPayments` take no owner argument at all —
 * they resolve to "my shop" vs. "every shop" via RLS on the caller's role,
 * so the same calls as Admin already correctly scope to this seller.
 */
export async function SellerKpiRow({ from, to }: SellerKpiRowProps) {
  let summary: Awaited<ReturnType<typeof getSalesSummary>>;
  let pendingOrders: number;
  let totalProducts: number;
  let lowStockCount: number;
  let pendingPayments: number;

  try {
    const user = await requireSessionUser();
    const owner = { sellerId: user.id, shopId: await getOwnShopId(user.id) };
    const [salesSummary, orderSummary, products, lowStock, payments] = await Promise.all([
      getSalesSummary(from, to, null),
      getDashboardOrderSummary(),
      listDashboardProducts(owner),
      getLowStockReport(),
      listPendingPayments(),
    ]);
    summary = salesSummary;
    pendingOrders = orderSummary.statusCounts.pending;
    totalProducts = products.length;
    lowStockCount = lowStock.length;
    pendingPayments = payments.length;
  } catch {
    return <ErrorState message="We couldn't load your shop's overview right now." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        href={ROUTES.sellerReports}
        label="Total Revenue"
        value={formatCurrency(summary.revenueCents)}
        icon={TrendingUp}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatCard
        href={ROUTES.sellerOrders}
        label="Total Orders"
        value={summary.totalOrders}
        icon={ShoppingBag}
        iconBg="bg-info/10"
        iconColor="text-info"
      />
      <StatCard
        href={ROUTES.sellerOrders}
        label="Pending Orders"
        value={pendingOrders}
        icon={Timer}
        iconBg="bg-warning/10"
        iconColor="text-warning"
      />
      <StatCard
        href={ROUTES.sellerProducts}
        label="Total Products"
        value={totalProducts}
        icon={Package}
        iconBg="bg-success/10"
        iconColor="text-success"
      />
      <StatCard
        href={ROUTES.sellerInventory}
        label="Low Stock"
        value={lowStockCount}
        icon={AlertTriangle}
        iconBg="bg-danger/10"
        iconColor="text-danger"
      />
      <StatCard
        href={ROUTES.sellerPayments}
        label="Pending Payments"
        value={pendingPayments}
        icon={CreditCard}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
    </div>
  );
}

export function SellerKpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="mb-4 h-9 w-9 rounded-lg" />
          <Skeleton className="mb-2 h-7 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
