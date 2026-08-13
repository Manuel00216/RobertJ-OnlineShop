import type { ReactNode } from "react";

import { BarChart, type BarChartDatum } from "@/components/charts/BarChart";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { getSalesSummary } from "@/lib/supabase/queries";

import type { ReportFilters } from "../types/report.types";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-1 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-400">
          {label}
        </p>
        <p className="font-serif text-3xl leading-none text-rj-black">{value}</p>
        {hint ? <p className="text-xs text-rj-gray-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

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
      label: "QR transfer",
      value: summary.qrPaidOrders,
      valueLabel: `${summary.qrPaidOrders}`,
      tone: "info",
    },
    {
      label: "Awaiting payment",
      value: summary.pendingPaymentOrders,
      valueLabel: `${summary.pendingPaymentOrders}`,
      tone: "warning",
    },
  ];

  const hasPaymentData =
    summary.codPaidOrders + summary.qrPaidOrders + summary.pendingPaymentOrders > 0;

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

      <Card className="border-rj-gray-100">
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-400">
            Payment method (paid orders)
          </p>
          {hasPaymentData ? (
            <BarChart data={paymentSplit} ariaLabel="Paid orders by payment method" />
          ) : (
            <p className="text-sm text-rj-gray-500">
              No confirmed or pending payments in this range yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
