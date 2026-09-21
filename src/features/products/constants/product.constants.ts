import type { ProductStatus } from "@/constants/status";

/**
 * Badge tones for the product status chip, kept as a local union so these
 * constants stay decoupled from the `Badge` UI component (mirrors
 * `features/orders/constants/order.constants.ts`'s exact pattern).
 */
export type ProductStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const PRODUCT_STATUS_TONE_MAP: Record<ProductStatus, ProductStatusTone> = {
  draft: "neutral",
  active: "success",
  sold: "warning",
  archived: "neutral",
};

export function getProductStatusTone(status: ProductStatus): ProductStatusTone {
  return PRODUCT_STATUS_TONE_MAP[status];
}

/**
 * At or below this remaining quantity, stock UI switches from a plain "in
 * stock" state to an "Only N left" warning — matches the wording in the
 * `create_order` stock-check error ("Only % left of %"). Shared by
 * `ProductTile`, the PDP, and `ProductQuantityAndAddToCart` so the threshold
 * reads the same everywhere a buyer sees it.
 */
export const LOW_STOCK_THRESHOLD = 5;
