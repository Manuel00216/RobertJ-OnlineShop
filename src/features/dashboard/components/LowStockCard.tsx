import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { StockStatusBadge } from "@/features/inventory/components/StockStatusBadge";
import { getLowStockReport } from "@/lib/supabase/queries";

const MAX_ROWS = 5;

/** Products needing restock attention — Inventory's own low-stock report, capped for the overview. */
export async function LowStockCard() {
  let items;
  try {
    items = await getLowStockReport();
  } catch {
    return <ErrorState message="We couldn't load low-stock products right now." />;
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-rj-black">Low stock</h2>
          <Link href={ROUTES.inventory} className="text-xs font-semibold text-rj-black underline">
            View inventory →
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Stock looks healthy" description="Nothing needs restocking right now." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.slice(0, MAX_ROWS).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-rj-black">{item.productTitle}</p>
                  <p className="text-xs text-rj-gray-600">{item.quantity} left</p>
                </div>
                <StockStatusBadge status={item.stockStatus} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function LowStockCardSkeleton() {
  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
