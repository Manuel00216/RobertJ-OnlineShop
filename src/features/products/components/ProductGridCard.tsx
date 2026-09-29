"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { RowMenu } from "@/components/ui/row-menu";
import { PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { ProductStatusBadge } from "@/features/products/components/ProductStatusBadge";
import { getCoverImage, type Product } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

function initials(title: string) {
  const words = title.split(" ").filter(Boolean);
  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
}

export interface ProductGridCardProps {
  product: Product;
  /** Pre-rendered by the parent's `stockCell(product, hasVariants)` — same badge as the table/mobile views, not reimplemented here. */
  stock: ReactNode;
  selected: boolean;
  isAdmin: boolean;
  inventoryHref: string;
  menuOpen: boolean;
  isPending: boolean;
  confirmingArchive: boolean;
  assigningShop: boolean;
  shops: Shop[];
  selectedShopId: string;
  onToggleSelect: (checked: boolean) => void;
  onEdit: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRequestArchive: () => void;
  onConfirmArchive: () => void;
  onCancelArchive: () => void;
  onRequestAssignShop: () => void;
  onSelectedShopIdChange: (shopId: string) => void;
  onConfirmAssignShop: () => void;
  onCancelAssignShop: () => void;
}

/**
 * Dashboard product management card — the Grid View counterpart to
 * `ProductsDataTable`'s table row / mobile card. Not a reuse of the
 * storefront's `ProductTile` (no wishlist/add-to-cart/quick-buy — this is a
 * management surface, not a shopping one). Purely presentational: every
 * piece of selection/edit/archive/assign-shop state and the Server Actions
 * behind them live in `ProductsDataTable`, the single owner shared by
 * Seller and Admin; this component only renders what it's given.
 */
export function ProductGridCard({
  product,
  stock,
  selected,
  isAdmin,
  inventoryHref,
  menuOpen,
  isPending,
  confirmingArchive,
  assigningShop,
  shops,
  selectedShopId,
  onToggleSelect,
  onEdit,
  onMenuOpenChange,
  onRequestArchive,
  onConfirmArchive,
  onCancelArchive,
  onRequestAssignShop,
  onSelectedShopIdChange,
  onConfirmAssignShop,
  onCancelAssignShop,
}: ProductGridCardProps) {
  const cover = getCoverImage(product);
  const showAssignToShop = isAdmin && product.shopId === null;

  function stopPropagation(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className={cn(
        "relative flex cursor-pointer flex-col transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-lg bg-muted">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.altText ?? ""}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-lg font-bold text-muted-foreground">
            {initials(product.title)}
          </span>
        )}
      </div>
      {/* Checkbox and RowMenu are positioned relative to the Card, not the
          image wrapper above — the image wrapper clips to `overflow-hidden`
          for its rounded corners, which would also clip the RowMenu's
          absolutely-positioned dropdown panel if it lived inside there. */}
      <div
        className="absolute left-2 top-2"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {/* No background chip here (unlike the RowMenu chip below) — a
            solid fill read as a stray white patch against the muted
            placeholder. `border-border` (swapping out Checkbox's default
            `border-rj-gray-300`, a fixed brand token not meant for the
            theme-scoped dashboard) plus `shadow` keep it defined against
            arbitrary product photos without needing an opaque backdrop. */}
        <Checkbox
          checked={selected}
          onChange={(event) => onToggleSelect(event.target.checked)}
          aria-label={`Select ${product.title}`}
          className="border-border shadow"
        />
      </div>
      <div
        className="absolute right-2 top-2 rounded-md border border-border bg-card shadow-sm"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        <RowMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
          >
            Edit
          </button>
          <Link
            href={`${inventoryHref}?search=${encodeURIComponent(product.title)}`}
            onClick={() => onMenuOpenChange(false)}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
          >
            Manage stock
          </Link>
          {showAssignToShop ? (
            <button
              type="button"
              onClick={onRequestAssignShop}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
            >
              Assign to shop
            </button>
          ) : null}
          <hr className="my-1 border-border" />
          <button
            type="button"
            onClick={onRequestArchive}
            className="w-full rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
          >
            Archive
          </button>
        </RowMenu>
      </div>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <button
            type="button"
            onClick={onEdit}
            className="block w-full truncate text-left text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {product.title}
          </button>
          <p className="text-xs text-muted-foreground">{PRODUCT_CONDITION_LABELS[product.condition]}</p>
        </div>

        <p className="text-sm font-medium text-foreground">{formatCurrency(product.priceCents, product.currency)}</p>
        <p className="text-xs text-muted-foreground">{product.categoryName ?? "No category"}</p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {stock}
          <ProductStatusBadge status={product.status} />
          {product.shopId === null ? <Badge tone="warning">Unassigned</Badge> : null}
        </div>

        {confirmingArchive ? (
          <div onClick={stopPropagation} onKeyDown={stopPropagation}>
            <ConfirmPanel
              label={`Archive ${product.title}`}
              title={`Archive ${product.title}?`}
              tone="danger"
              confirmLabel="Confirm archive"
              isPending={isPending}
              onConfirm={onConfirmArchive}
              onCancel={onCancelArchive}
            />
          </div>
        ) : null}

        {assigningShop ? (
          <div
            className="flex flex-col gap-2 rounded-md border border-border bg-muted p-2"
            onClick={stopPropagation}
            onKeyDown={stopPropagation}
          >
            <select
              value={selectedShopId}
              onChange={(event) => onSelectedShopIdChange(event.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="">Select a shop…</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="rjSm"
                isLoading={isPending}
                disabled={!selectedShopId}
                onClick={onConfirmAssignShop}
              >
                Assign
              </Button>
              <Button type="button" variant="outline" size="rjSm" disabled={isPending} onClick={onCancelAssignShop}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
