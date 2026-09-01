import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { getDashboardOrderSummary, listPendingPayments } from "@/lib/supabase/queries";

/**
 * Shortcut tiles for the Seller Portal dashboard — structural twin of
 * `AdminQuickAccess`, swapping "Process Returns" (admin-only queue sellers
 * don't have) for "Pending Payments" (sellers already verify their own
 * shop's QR receipts at `/seller/payments`).
 */
export async function SellerQuickAccess() {
  let pendingOrders: number;
  let pendingPayments: number;

  try {
    const [orderSummary, payments] = await Promise.all([
      getDashboardOrderSummary(),
      listPendingPayments(),
    ]);
    pendingOrders = orderSummary.statusCounts.pending;
    pendingPayments = payments.length;
  } catch {
    return <ErrorState message="We couldn't load quick actions right now." />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Access</h2>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={ROUTES.sellerProducts}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Product</span>
        </Link>
        <Link
          href={ROUTES.sellerOrders}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-3 text-xs font-medium text-foreground transition-all hover:bg-muted"
        >
          <span>Pending Orders</span>
          {pendingOrders > 0 && <Badge tone="danger">{pendingOrders}</Badge>}
        </Link>
        <Link
          href={ROUTES.sellerPayments}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-3 text-xs font-medium text-foreground transition-all hover:bg-muted"
        >
          <span>Pending Payments</span>
          {pendingPayments > 0 && <Badge tone="danger">{pendingPayments}</Badge>}
        </Link>
        <Link
          href={ROUTES.sellerReports}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-3 text-xs font-medium text-foreground transition-all hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span>Generate Report</span>
        </Link>
      </div>
    </div>
  );
}

export function SellerQuickAccessSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="mb-3 h-5 w-24" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
