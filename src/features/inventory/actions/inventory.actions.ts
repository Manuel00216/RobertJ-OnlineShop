"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { adjustStockSchema } from "@/features/inventory/schemas/inventory.schema";
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
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.dashboardProducts);
    return ok(item);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not adjust stock.");
  }
}

/** Recent stock movement history for one product — powers the row's expandable history panel. */
export async function getStockHistoryAction(
  productId: string,
): Promise<ActionResult<StockAdjustment[]>> {
  try {
    await queries.requireRole(DASHBOARD_ROLES);
    const history = await queries.listStockAdjustments(productId);
    return ok(history);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load stock history.",
    );
  }
}
