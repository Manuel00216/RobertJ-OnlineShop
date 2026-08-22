"use client";

import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { getStockHistoryAction } from "@/features/inventory/actions/inventory.actions";
import { STOCK_ADJUSTMENT_REASON_LABELS } from "@/features/inventory/constants/inventory.constants";
import type { StockAdjustment } from "@/features/inventory/types/inventory.types";
import { formatDateTime } from "@/lib/utils/date";

export interface StockHistoryPanelProps {
  productId: string;
}

type Result =
  | { key: string; ok: true; data: StockAdjustment[] }
  | { key: string; ok: false; error: string };

/** Recent stock movement history for one product, fetched on first expand. */
export function StockHistoryPanel({ productId }: StockHistoryPanelProps) {
  // Tagged with the productId it was fetched for, mirroring CartSummary's
  // `availability` pattern — avoids setState-in-effect-body by never
  // resetting state synchronously; loading is just "no result for this id yet".
  const [result, setResult] = useState<Result | null>(null);
  const [, startFetch] = useTransition();

  useEffect(() => {
    startFetch(async () => {
      const response = await getStockHistoryAction(productId);
      setResult(
        response.success
          ? { key: productId, ok: true, data: response.data }
          : { key: productId, ok: false, error: response.error },
      );
    });
  }, [productId, startFetch]);

  const current = result?.key === productId ? result : null;

  if (current && !current.ok) {
    return <ErrorState title="Couldn't load stock history" message={current.error} />;
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (current.data.length === 0) {
    return (
      <EmptyState title="No stock movement yet" description="Adjustments will appear here." />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-rj-gray-100">
      {current.data.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={entry.delta > 0 ? "success" : "danger"}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </Badge>
              <span className="font-medium text-rj-black">
                {STOCK_ADJUSTMENT_REASON_LABELS[entry.reason]}
              </span>
            </div>
            {entry.note ? (
              <p className="mt-0.5 truncate text-xs text-rj-gray-600">{entry.note}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right text-xs text-rj-gray-500">
            <p>{entry.previousQuantity} → {entry.newQuantity}</p>
            <p>{formatDateTime(entry.createdAt)}</p>
            {entry.createdByName ? <p>{entry.createdByName}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
