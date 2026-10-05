import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { getOrderAttentionCounts } from "@/lib/supabase/queries";

/**
 * Shortcut tiles for the Seller Portal dashboard — structural twin of
 * `AdminQuickAccess`, swapping "Process Returns" (admin-only queue sellers
 * don't have) for a plain "Payments" link. Payments no longer need a
 * pending-count badge — Xendit payments settle themselves via webhook, and
 * COD is marked collected from the order detail page, not a queue here.
 *
 * The badge count uses `getOrderAttentionCounts().needsConfirmation` — the
 * same definition as `SellerKpiRow`'s "Pending Orders" tile, the topbar
 * notification bell, and the Action Center card — so this dashboard never
 * shows two different numbers for the same thing.
 */
export async function SellerQuickAccess() {
  let pendingOrders: number;

  try {
    const attentionCounts = await getOrderAttentionCounts();
    pendingOrders = attentionCounts.needsConfirmation;
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
          <span>Payments</span>
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
