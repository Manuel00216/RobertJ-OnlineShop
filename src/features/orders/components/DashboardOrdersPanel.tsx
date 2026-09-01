import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { buyerOrderListParamsSchema } from "@/features/orders/schemas/order.schema";
import type { Order, OrderListParams } from "@/features/orders/types/order.types";
import { cn } from "@/lib/utils/cn";
import { listDashboardOrders } from "@/lib/supabase/queries";
import type { PaginatedResult } from "@/types/pagination.types";

import { OrderCard } from "./OrderCard";

export interface DashboardOrdersPanelProps {
  searchParams: Record<string, string | string[] | undefined>;
  /** Overridable for the Admin Portal, which links into `/admin/orders` instead of `/dashboard/orders`. */
  clearFiltersHref?: string;
  orderHref?: (id: string) => string;
}

/**
 * Dashboard equivalent of `OrderListSection` — same composition, but reads
 * via `listDashboardOrders()` (no manual seller/admin filter; RLS is the
 * boundary) instead of the buyer-scoped `listBuyerOrders`. The list-params
 * schema is shared as-is: none of its fields (search/status/page/pageSize)
 * are buyer-specific.
 */
export async function DashboardOrdersPanel({
  searchParams,
  clearFiltersHref = ROUTES.dashboardOrders,
  orderHref = ROUTES.dashboardOrderDetail,
}: DashboardOrdersPanelProps) {
  const parsed = buyerOrderListParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return (
      <ErrorState message="Those filters aren't valid. Try clearing your search." />
    );
  }

  const params: OrderListParams = parsed.data;

  let result: PaginatedResult<Order>;
  try {
    result = await listDashboardOrders(params);
  } catch {
    return <ErrorState message="We couldn't load orders right now." />;
  }

  const { items, page, totalPages, total } = result;

  if (items.length === 0) {
    const filtering = Boolean(params.search || params.status);
    return (
      <EmptyState
        title={filtering ? "No matching orders" : "No orders yet"}
        description={
          filtering
            ? "Try a different order ID or status filter."
            : "Orders placed against your shop will appear here."
        }
        action={
          filtering ? (
            <Link
              href={clearFiltersHref}
              className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
            >
              Clear filters
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400"
        aria-live="polite"
      >
        {total} order{total === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} href={orderHref(order.id)} />
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <PaginationControls page={page} totalPages={totalPages} />
      ) : null}
    </section>
  );
}
