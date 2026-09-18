import { BarChart, type BarChartDatum } from "@/components/charts/BarChart";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/currency";
import { getSalesSummary } from "@/lib/supabase/queries";

import type { ReportFilters } from "../types/report.types";

/**
 * KPI grid + confirmed-payment method split for the selected range. Reads the
 * one-row summary RPC (RLS/DEFINER-scoped: seller → own shop, admin → all or
 * one shop). Revenue counts only orders whose payment_status='paid'.
 */
export async function SalesSummaryPanel({ filters }: { filters: ReportFilters }) {
  let summary;
  try {
    summary = await getSalesSummary(filters.from, filters.to, filters.shopId);
  } catch {
    return <ErrorState message="We couldn't load the sales summary right now." />;
  }

  const paymentSplit: BarChartDatum[] = [
    {
      label: "Cash on Delivery",
      value: summary.codPaidOrders,
      valueLabel: `${summary.codPaidOrders}`,
      tone: "success",
    },
    {
      label: "Online Payment (Xendit)",
      value: summary.xenditPaidOrders,
      valueLabel: `${summary.xenditPaidOrders}`,
      tone: "info",
    },
    {
      label: "QR transfer (legacy)",
      value: summary.qrPaidOrders,
      valueLabel: `${summary.qrPaidOrders}`,
      tone: "neutral",
    },
    {
      label: "Awaiting payment",
      value: summary.pendingPaymentOrders,
      valueLabel: `${summary.pendingPaymentOrders}`,
      tone: "warning",
    },
  ];

  const hasPaymentData =
    summary.codPaidOrders +
      summary.xenditPaidOrders +
      summary.qrPaidOrders +
      summary.pendingPaymentOrders >
    0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Revenue"
          value={formatCurrency(summary.revenueCents)}
          hint="Paid orders only"
        />
        <StatCard label="Orders placed" value={summary.totalOrders} />
        <StatCard
          label="Paid orders"
          value={summary.paidOrders}
          hint={`${summary.pendingPaymentOrders} awaiting payment`}
        />
        <StatCard
          label="Avg order value"
          value={formatCurrency(summary.avgOrderValueCents)}
          hint="Across paid orders"
        />
        <StatCard label="Units sold" value={summary.unitsSold} />
        <StatCard label="Cancelled" value={summary.cancelledOrders} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Payment method (paid orders)
          </p>
          {hasPaymentData ? (
            <BarChart data={paymentSplit} ariaLabel="Paid orders by payment method" />
          ) : (
            <p className="text-sm text-muted-foreground">
              No confirmed or pending payments in this range yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
