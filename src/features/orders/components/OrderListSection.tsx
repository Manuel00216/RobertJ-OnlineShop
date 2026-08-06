import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { buyerOrderListParamsSchema } from "@/features/orders/schemas/order.schema";
import type { Order, OrderListParams } from "@/features/orders/types/order.types";
import { cn } from "@/lib/utils/cn";
import { listBuyerOrders } from "@/lib/supabase/queries";
import type { PaginatedResult } from "@/types/pagination.types";

import { OrderCard } from "./OrderCard";

export interface OrderListSectionProps {
  searchParams: Record<string, string | string[] | undefined>;
  buyerId: string;
}

/**
 * Server Component that owns data loading for the order history. Kept inside a
 * keyed Suspense boundary so a new search/filter restarts loading from scratch.
 */
export async function OrderListSection({
  searchParams,
  buyerId,
}: OrderListSectionProps) {
  const parsed = buyerOrderListParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return (
      <ErrorState message="Those filters aren't valid. Try clearing your search." />
    );
  }

  const params: OrderListParams = parsed.data;

  let result: PaginatedResult<Order>;
  try {
    result = await listBuyerOrders(buyerId, params);
  } catch {
    return (
      <ErrorState message="We couldn't load your orders right now." />
    );
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
            : "Orders you place will appear here."
        }
        action={
          filtering ? (
            <Link
              href={ROUTES.orders}
              className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
            >
              Clear filters
            </Link>
          ) : (
            <Link
              href={ROUTES.products}
              className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
            >
              Browse products
            </Link>
          )
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
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <PaginationControls page={page} totalPages={totalPages} />
      ) : null}
    </section>
  );
}
