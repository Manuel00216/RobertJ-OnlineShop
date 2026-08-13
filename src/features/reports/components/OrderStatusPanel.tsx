import { BarChart, type BarChartDatum } from "@/components/charts/BarChart";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import {
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/features/orders/constants/order.constants";
import { getOrderStatusBreakdown } from "@/lib/supabase/queries";

import type { OrderStatusCount, ReportFilters } from "../types/report.types";

/** Order counts grouped by fulfilment status, reusing the shared status tones. */
export async function OrderStatusPanel({ filters }: { filters: ReportFilters }) {
  let breakdown: OrderStatusCount[];
  try {
    breakdown = await getOrderStatusBreakdown(filters.from, filters.to, filters.shopId);
  } catch {
    return <ErrorState message="We couldn't load the status breakdown right now." />;
  }

  const data: BarChartDatum[] = breakdown.map((row) => ({
    label: getOrderStatusLabel(row.status),
    value: row.orderCount,
    valueLabel: `${row.orderCount}`,
    tone: getOrderStatusTone(row.status),
  }));

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-400">
          Orders by status
        </p>
        {data.length > 0 ? (
          <BarChart data={data} ariaLabel="Orders grouped by fulfilment status" />
        ) : (
          <EmptyState
            title="No orders in this range"
            description="Once orders are placed, their statuses will break down here."
          />
        )}
      </CardContent>
    </Card>
  );
}
