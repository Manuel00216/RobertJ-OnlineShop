"use client";

import { Fragment, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RowMenu } from "@/components/ui/row-menu";
import { ErrorState } from "@/components/feedback/ErrorState";
import { bulkAdjustStockAction } from "@/features/inventory/actions/inventory.actions";
import {
  MANUAL_STOCK_ADJUSTMENT_REASONS,
  STOCK_ADJUSTMENT_REASON_LABELS,
} from "@/features/inventory/constants/inventory.constants";
import { StockAdjustmentForm } from "@/features/inventory/components/StockAdjustmentForm";
import { StockHistoryPanel } from "@/features/inventory/components/StockHistoryPanel";
import { StockStatusBadge } from "@/features/inventory/components/StockStatusBadge";
import type { InventoryItem } from "@/features/inventory/types/inventory.types";

export interface InventoryDataTableProps {
  items: InventoryItem[];
  /** Shown only for an admin, to distinguish shops in a cross-shop list. */
  isAdmin: boolean;
}

const selectClasses =
  "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Inventory dashboard table — desktop `<table>` + `sm:hidden` card
 * fallback, checkbox multi-select driving a bulk stock-adjustment bar, and
 * a row menu (kebab) for Adjust stock/History. Single-row adjust/history
 * keep the existing inline-expand interaction (`StockAdjustmentForm`/
 * `StockHistoryPanel`, unchanged) — they just live inside a table row now
 * instead of a standalone card.
 */
export function InventoryDataTable({ items, isAdmin }: InventoryDataTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<{ id: string; mode: "adjust" | "history" } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState(MANUAL_STOCK_ADJUSTMENT_REASONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const someSelected = items.some((i) => selected.has(i.id));
  const selectedCount = selected.size;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleExpand(id: string, mode: "adjust" | "history") {
    setExpanded((prev) => (prev?.id === id && prev.mode === mode ? null : { id, mode }));
  }

  function applyBulkAdjust() {
    setError(null);
    setNotice(null);
    const parsedDelta = Number.parseInt(delta, 10);
    if (Number.isNaN(parsedDelta) || parsedDelta === 0) {
      setError("Enter a non-zero adjustment.");
      return;
    }
    if (reason === "other" && !note.trim()) {
      setError("Add a note explaining this adjustment.");
      return;
    }
    const selectedItems = items.filter((i) => selected.has(i.id));
    startTransition(async () => {
      const result = await bulkAdjustStockAction(
        selectedItems.map((i) => ({ productId: i.productId, variantId: i.variantId })),
        parsedDelta,
        reason,
        note || undefined,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      const { updated, failed } = result.data;
      setNotice(
        `Adjusted ${updated} row${updated === 1 ? "" : "s"}` +
          (failed.length ? `; ${failed.length} failed (${failed[0].error}).` : "."),
      );
      setSelected(new Set());
      setDelta("");
      setNote("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-semibold text-foreground">{selectedCount} selected</span>
          <div className="flex flex-col gap-1">
            <label htmlFor="bulk-delta" className="text-xs font-medium text-muted-foreground">
              Adjustment
            </label>
            <input
              id="bulk-delta"
              type="number"
              step="1"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="e.g. 10 or -2"
              className={`${selectClasses} w-32`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="bulk-reason" className="text-xs font-medium text-muted-foreground">
              Reason
            </label>
            <select
              id="bulk-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as typeof reason)}
              className={selectClasses}
            >
              {MANUAL_STOCK_ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {STOCK_ADJUSTMENT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="bulk-note" className="text-xs font-medium text-muted-foreground">
              Note {reason === "other" ? null : <span className="font-normal">(optional)</span>}
            </label>
            <input
              id="bulk-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Damaged in storage"
              className={`${selectClasses} w-48`}
            />
          </div>
          <Button type="button" variant="primary" size="rjSm" isLoading={isPending} onClick={applyBulkAdjust}>
            Apply to selected
          </Button>
          <Button type="button" variant="ghost" size="rjSm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {error ? <ErrorState title="Something went wrong" message={error} /> : null}
      {notice ? <p className="text-sm text-success">{notice}</p> : null}

      {/* ---------------- Desktop table ---------------- */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="w-10 p-3">
                <Checkbox
                  checked={someSelected && !allSelected ? "indeterminate" : allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Select all inventory rows on this page"
                />
              </th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Threshold</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="p-3 align-top">
                    <Checkbox
                      checked={selected.has(item.id)}
                      onChange={(event) => toggleOne(item.id, event.target.checked)}
                      aria-label={`Select ${item.productTitle}`}
                    />
                  </td>
                  <td className="p-3 align-top">
                    <p className="text-sm font-semibold text-foreground">
                      {item.productTitle}
                      {item.variantLabel ? (
                        <span className="font-normal text-muted-foreground"> — {item.variantLabel}</span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.variantId ? <Badge tone="info">Variant</Badge> : null}
                      {isAdmin && item.shopName ? <Badge tone="neutral">{item.shopName}</Badge> : null}
                    </div>
                  </td>
                  <td className="p-3 align-top text-sm font-medium text-foreground">{item.quantity}</td>
                  <td className="p-3 align-top text-sm text-muted-foreground">{item.lowStockThreshold}</td>
                  <td className="p-3 align-top"><StockStatusBadge status={item.stockStatus} /></td>
                  <td className="p-3 align-top text-right">
                    <RowMenu open={openMenuId === item.id} onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}>
                      <button
                        type="button"
                        onClick={() => {
                          toggleExpand(item.id, "adjust");
                          setOpenMenuId(null);
                        }}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                      >
                        Adjust stock
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toggleExpand(item.id, "history");
                          setOpenMenuId(null);
                        }}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                      >
                        History
                      </button>
                    </RowMenu>
                  </td>
                </tr>
                {expanded?.id === item.id ? (
                  <tr>
                    <td colSpan={6} className="border-b border-border bg-muted p-4">
                      {expanded.mode === "adjust" ? (
                        <StockAdjustmentForm item={item} onDone={() => setExpanded(null)} />
                      ) : (
                        <StockHistoryPanel productId={item.productId} variantId={item.variantId} />
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- Mobile cards ---------------- */}
      <div className="flex flex-col gap-3 sm:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(item.id)}
                  onChange={(event) => toggleOne(item.id, event.target.checked)}
                  aria-label={`Select ${item.productTitle}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.productTitle}
                    {item.variantLabel ? (
                      <span className="font-normal text-muted-foreground"> — {item.variantLabel}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} in stock · threshold {item.lowStockThreshold}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StockStatusBadge status={item.stockStatus} />
                    {item.variantId ? <Badge tone="info">Variant</Badge> : null}
                    {isAdmin && item.shopName ? <Badge tone="neutral">{item.shopName}</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="rjSm"
                  onClick={() => toggleExpand(item.id, "adjust")}
                >
                  {expanded?.id === item.id && expanded.mode === "adjust" ? "Hide" : "Adjust stock"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="rjSm"
                  onClick={() => toggleExpand(item.id, "history")}
                >
                  {expanded?.id === item.id && expanded.mode === "history" ? "Hide" : "History"}
                </Button>
              </div>
              {expanded?.id === item.id ? (
                <div className="rounded-xl border border-border bg-muted p-4">
                  {expanded.mode === "adjust" ? (
                    <StockAdjustmentForm item={item} onDone={() => setExpanded(null)} />
                  ) : (
                    <StockHistoryPanel productId={item.productId} variantId={item.variantId} />
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
