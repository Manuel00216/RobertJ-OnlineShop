import { BarChart, type BarChartDatum } from "@/components/charts/BarChart";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { getRevenueByCategory } from "@/lib/supabase/queries";

import type { ReportFilters } from "../types/report.types";

/** Category-level revenue rollup for the range (paid orders) — complements Top Products' per-product view. Seller Reports only. */
export async function RevenueByCategoryPanel({ filters }: { filters: Pick<ReportFilters, "from" | "to"> }) {
  let rows: Awaited<ReturnType<typeof getRevenueByCategory>>;
  try {
    rows = await getRevenueByCategory(filters.from, filters.to);
  } catch {
    return <ErrorState message="We couldn't load revenue by category right now." />;
  }

  const data: BarChartDatum[] = rows.map((row) => ({
    label: row.categoryName,
    value: row.revenueCents,
    valueLabel: formatCurrency(row.revenueCents),
    tone: "info",
  }));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Revenue by category
        </p>
        {data.length > 0 ? (
          <BarChart data={data} ariaLabel="Revenue by category" />
        ) : (
          <EmptyState
            title="No sales yet"
            description="Category revenue will appear here once orders come in."
          />
        )}
      </CardContent>
    </Card>
  );
}
