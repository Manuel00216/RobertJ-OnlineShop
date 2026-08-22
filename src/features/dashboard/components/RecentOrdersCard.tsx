import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { OrderCard } from "@/features/orders/components/OrderCard";
import { getDashboardOrderSummary } from "@/lib/supabase/queries";

/** The 5 most recent orders visible to the caller (own shop, or every shop for admin). */
export async function RecentOrdersCard() {
  let recentOrders;
  try {
    ({ recentOrders } = await getDashboardOrderSummary());
  } catch {
    return <ErrorState message="We couldn't load recent orders right now." />;
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-rj-black">Recent orders</h2>
          <Link href={ROUTES.dashboardOrders} className="text-xs font-semibold text-rj-black underline">
            View all orders →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState title="No orders yet" description="New orders will show up here." />
        ) : (
          <div className="flex flex-col gap-3">
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} href={ROUTES.dashboardOrderDetail(order.id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentOrdersCardSkeleton() {
  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </CardContent>
    </Card>
  );
}
