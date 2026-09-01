import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { RETURN_STATUS } from "@/constants/status";
import { getDashboardOrderSummary, listReturnRequests } from "@/lib/supabase/queries";

/** Shortcut tiles for the Admin Portal dashboard, with real pending-work counts (no mock badges). */
export async function AdminQuickAccess() {
  let pendingOrders: number;
  let pendingReturns: number;

  try {
    const [orderSummary, returns] = await Promise.all([
      getDashboardOrderSummary(),
      listReturnRequests(RETURN_STATUS.sellerAccepted),
    ]);
    pendingOrders = orderSummary.statusCounts.pending;
    pendingReturns = returns.length;
  } catch {
    return <ErrorState message="We couldn't load quick actions right now." />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Quick Access</h2>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={ROUTES.adminProducts}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-3 text-xs font-medium text-white transition-all hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Product</span>
        </Link>
        <Link
          href={ROUTES.adminOrders}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          <span>Pending Orders</span>
          {pendingOrders > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-600">
              {pendingOrders}
            </span>
          )}
        </Link>
        <Link
          href={ROUTES.adminReturns}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          <span>Process Returns</span>
          {pendingReturns > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-600">
              {pendingReturns}
            </span>
          )}
        </Link>
        <Link
          href={ROUTES.adminReports}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-3 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span>Generate Report</span>
        </Link>
      </div>
    </div>
  );
}

export function AdminQuickAccessSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <Skeleton className="mb-3 h-5 w-24" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
