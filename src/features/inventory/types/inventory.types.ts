import type { ProductStatus } from "@/constants/status";
import type { StockAdjustmentReason } from "@/features/inventory/constants/inventory.constants";

/** Derived, not stored: quantity <= 0 is out of stock, <= threshold is low. */
export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

/** Domain model returned by the inventory service — one row per product. */
export interface InventoryItem {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: ProductStatus;
  shopId: string | null;
  shopName: string | null;
  quantity: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

/** One entry in a product's append-only stock movement history. */
export interface StockAdjustment {
  id: string;
  productId: string;
  shopId: string | null;
  delta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: StockAdjustmentReason;
  note: string | null;
  relatedOrderId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** Computes the derived stock status from a raw quantity/threshold pair. */
export function getStockStatus(
  quantity: number,
  lowStockThreshold: number,
): StockStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= lowStockThreshold) return "low_stock";
  return "in_stock";
}
