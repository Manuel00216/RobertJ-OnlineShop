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
  getSalesSummary,
  listDashboardProducts,
  listPendingPayments,
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

export interface AdminKpiRowProps {
  from: string;
  to: string;
}

/**
 * Platform-wide KPI tiles for the Admin Portal dashboard — same data sources
 * as the Shop Owner dashboard's `DashboardKpiRow` (scope is always
 * platform-wide here, so no `isAdmin` branch is needed), restyled to match
 * the Figma Admin Portal's stat-card look.
 */
export async function AdminKpiRow({ from, to }: AdminKpiRowProps) {
  let summary: Awaited<ReturnType<typeof getSalesSummary>>;
  let pendingOrders: number;
  let totalProducts: number;
  let lowStockCount: number;
  let pendingPayments: number;

  try {
    const [salesSummary, orderSummary, products, lowStock, payments] = await Promise.all([
      getSalesSummary(from, to, null),
      getDashboardOrderSummary(),
      listDashboardProducts(null),
      getLowStockReport(),
      listPendingPayments(),
    ]);
    summary = salesSummary;
    pendingOrders = orderSummary.statusCounts.pending;
    totalProducts = products.length;
    lowStockCount = lowStock.length;
    pendingPayments = payments.length;
  } catch {
    return <ErrorState message="We couldn't load the platform overview right now." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        href={ROUTES.adminReports}
        label="Total Revenue"
        value={formatCurrency(summary.revenueCents)}
        icon={TrendingUp}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatCard
        href={ROUTES.adminOrders}
        label="Total Orders"
        value={summary.totalOrders}
        icon={ShoppingBag}
        iconBg="bg-info/10"
        iconColor="text-info"
      />
      <StatCard
        href={ROUTES.adminOrders}
        label="Pending Orders"
        value={pendingOrders}
        icon={Timer}
        iconBg="bg-warning/10"
        iconColor="text-warning"
      />
      <StatCard
        href={ROUTES.adminProducts}
        label="Total Products"
        value={totalProducts}
        icon={Package}
        iconBg="bg-success/10"
        iconColor="text-success"
      />
      <StatCard
        href={ROUTES.adminInventory}
        label="Low Stock"
        value={lowStockCount}
        icon={AlertTriangle}
        iconBg="bg-danger/10"
        iconColor="text-danger"
      />
      <StatCard
        href={ROUTES.adminPayments}
        label="Pending Payments"
        value={pendingPayments}
        icon={CreditCard}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
    </div>
  );
}

export function AdminKpiRowSkeleton() {
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
