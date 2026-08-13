"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StockAdjustmentForm } from "@/features/inventory/components/StockAdjustmentForm";
import { StockHistoryPanel } from "@/features/inventory/components/StockHistoryPanel";
import { StockStatusBadge } from "@/features/inventory/components/StockStatusBadge";
import type { InventoryItem } from "@/features/inventory/types/inventory.types";

export interface InventoryRowProps {
  item: InventoryItem;
  /** Shown only for an admin, to distinguish shops in a cross-shop list. */
  isAdmin: boolean;
}

/** One product's stock in the dashboard inventory list. Adjust/History expand inline, like DashboardProductRow's edit mode. */
export function InventoryRow({ item, isAdmin }: InventoryRowProps) {
  const [mode, setMode] = useState<"view" | "adjust" | "history">("view");

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-rj-black">
                {item.productTitle}
              </p>
              <StockStatusBadge status={item.stockStatus} />
              {isAdmin && item.shopName ? <Badge tone="neutral">{item.shopName}</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-rj-gray-600">
              {item.quantity} in stock · low-stock threshold {item.lowStockThreshold}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode(mode === "history" ? "view" : "history")}
            >
              {mode === "history" ? "Hide history" : "History"}
            </Button>
            <Button
              type="button"
              variant="rj"
              size="sm"
              onClick={() => setMode(mode === "adjust" ? "view" : "adjust")}
            >
              {mode === "adjust" ? "Cancel" : "Adjust stock"}
            </Button>
          </div>
        </div>

        {mode === "adjust" ? (
          <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-4">
            <StockAdjustmentForm item={item} onDone={() => setMode("view")} />
          </div>
        ) : null}

        {mode === "history" ? (
          <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-4">
            <StockHistoryPanel productId={item.productId} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
