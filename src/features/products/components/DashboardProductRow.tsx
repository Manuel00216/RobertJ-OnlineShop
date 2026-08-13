"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  archiveProductAction,
  assignProductShopAction,
} from "@/features/products/actions/product.actions";
import { ProductForm } from "@/features/products/components/ProductForm";
import { ProductStatusBadge } from "@/features/products/components/ProductStatusBadge";
import type { Category } from "@/features/categories/types/category.types";
import type { Product } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";
import { formatCurrency } from "@/lib/utils/currency";

export interface DashboardProductRowProps {
  product: Product;
  categories: Category[];
  /** Populated only for an admin — powers the create-form picker and the unassigned-row assign control. */
  shops: Shop[];
  isAdmin: boolean;
}

/**
 * One product in the dashboard management list. Edit swaps the row for an
 * inline `ProductForm`; archive uses the same inline-confirm shape as
 * `VerificationCard`. The "Unassigned" assign control is admin-only and only
 * shown for a legacy product with `shopId === null` (see the Phase 3 plan's
 * orphaned-product handling).
 */
export function DashboardProductRow({
  product,
  categories,
  shops,
  isAdmin,
}: DashboardProductRowProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [assigningShop, setAssigningShop] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (mode === "edit") {
    return (
      <Card className="border-rj-gray-100">
        <CardContent className="p-5">
          <ProductForm
            categories={categories}
            product={product}
            onDone={() => setMode("view")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setMode("view")}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProductAction(product.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirmingArchive(false);
    });
  }

  function handleAssignShop() {
    if (!selectedShopId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignProductShopAction(product.id, selectedShopId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAssigningShop(false);
    });
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-rj-black">{product.title}</p>
            <ProductStatusBadge status={product.status} />
            {product.shopId === null ? <Badge tone="warning">Unassigned</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-rj-gray-600">
            {formatCurrency(product.priceCents, product.currency)} · Qty {product.quantity}
          </p>
          {error ? (
            <div className="mt-2">
              <ErrorState title="Something went wrong" message={error} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && product.shopId === null ? (
            assigningShop ? (
              <>
                <select
                  value={selectedShopId}
                  onChange={(event) => setSelectedShopId(event.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">Select a shop…</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="rj"
                  size="sm"
                  isLoading={isPending}
                  disabled={!selectedShopId}
                  onClick={handleAssignShop}
                >
                  Assign
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setAssigningShop(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setAssigningShop(true)}>
                Assign to shop
              </Button>
            )
          ) : null}

          <Button type="button" variant="outline" size="sm" onClick={() => setMode("edit")}>
            Edit
          </Button>

          {confirmingArchive ? (
            <>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isPending}
                onClick={handleArchive}
              >
                Confirm archive
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmingArchive(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingArchive(true)}>
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
