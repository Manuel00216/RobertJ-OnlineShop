"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { adjustStockSchema, bulkAdjustStockSchema } from "@/features/inventory/schemas/inventory.schema";
import type {
  InventoryItem,
  StockAdjustment,
} from "@/features/inventory/types/inventory.types";

/** Manual stock change (restock/correction/shrinkage/other) from the Inventory dashboard. */
export async function adjustStockAction(
  _prevState: ActionResult<InventoryItem> | null,
  formData: FormData,
): Promise<ActionResult<InventoryItem>> {
  const parsed = adjustStockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireRole(DASHBOARD_ROLES);
    await queries.requireRateLimit(`adjustStock:${user.id}`, 30, 60);
    const item = await queries.adjustStock(parsed.data);
    revalidatePath(ROUTES.adminInventory);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerInventory);
    revalidatePath(ROUTES.sellerProducts);
    return ok(item);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not adjust stock.");
  }
}

/**
 * Applies one delta/reason/note to several inventory rows at once. Each row
 * still goes through the same `adjust_stock` RPC as the single-row form (via
 * `queries.adjustStock`), one call per row — the RPC computes each row's own
 * previous/new quantity and appends its own history entry, so this can't
 * collapse into a single bulk UPDATE without losing that per-row bookkeeping.
 * Partial failure is expected (e.g. one row can't go negative) and reported
 * back rather than aborting the rest.
 */
export async function bulkAdjustStockAction(
  items: Array<{ productId: string; variantId?: string | null }>,
  delta: number,
  reason: string,
  note?: string,
): Promise<ActionResult<{ updated: number; failed: Array<{ productId: string; error: string }> }>> {
  const parsed = bulkAdjustStockSchema.safeParse({
    items: items.map((item) => ({ productId: item.productId, variantId: item.variantId ?? undefined })),
    delta,
    reason,
    note,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireRole(DASHBOARD_ROLES);
    await queries.requireRateLimit(`bulkAdjustStock:${user.id}`, 10, 60);

    const failed: Array<{ productId: string; error: string }> = [];
    let updated = 0;
    for (const item of parsed.data.items) {
      try {
        await queries.adjustStock({
          productId: item.productId,
          variantId: item.variantId,
          delta: parsed.data.delta,
          reason: parsed.data.reason,
          note: parsed.data.note,
        });
        updated += 1;
      } catch (error) {
        failed.push({
          productId: item.productId,
          error: error instanceof Error ? error.message : "Could not adjust stock.",
        });
      }
    }

    revalidatePath(ROUTES.adminInventory);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerInventory);
    revalidatePath(ROUTES.sellerProducts);
    return ok({ updated, failed });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not adjust stock.");
  }
}

/**
 * Recent stock movement history for one product (or one of its variants) —
 * powers the row's expandable history panel. Omitting `variantId` scopes to
 * the product-level row's own history only, never a mix with its variants'.
 */
export async function getStockHistoryAction(
  productId: string,
  variantId?: string | null,
): Promise<ActionResult<StockAdjustment[]>> {
  try {
    await queries.requireRole(DASHBOARD_ROLES);
    const history = await queries.listStockAdjustments(productId, variantId);
    return ok(history);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load stock history.",
    );
  }
}
