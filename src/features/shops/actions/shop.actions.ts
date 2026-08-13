"use server";

import { revalidatePath } from "next/cache";

import { USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  createShopSchema,
  toggleShopActiveSchema,
  updateShopSchema,
} from "@/features/shops/schemas/shop.schema";
import type { Shop } from "@/features/shops/types/shop.types";

/** Admin-only: creates a shop. */
export async function createShopAction(
  _prevState: ActionResult<Shop> | null,
  formData: FormData,
): Promise<ActionResult<Shop>> {
  const parsed = createShopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole([USER_ROLES.admin]);
    const shop = await queries.createShop(parsed.data);
    revalidatePath(ROUTES.adminShops);
    revalidatePath(ROUTES.dashboardProducts);
    revalidatePath(ROUTES.inventory);
    return ok(shop);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create the shop.");
  }
}

/** Admin-only: edits a shop's name. */
export async function updateShopAction(
  _prevState: ActionResult<Shop> | null,
  formData: FormData,
): Promise<ActionResult<Shop>> {
  const parsed = updateShopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole([USER_ROLES.admin]);
    const shop = await queries.updateShop(parsed.data);
    revalidatePath(ROUTES.adminShops);
    return ok(shop);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update the shop.");
  }
}

/** Admin-only: toggles a shop's active status. */
export async function toggleShopActiveAction(
  shopId: string,
  active: boolean,
): Promise<ActionResult<Shop>> {
  const parsed = toggleShopActiveSchema.safeParse({ shopId, active });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole([USER_ROLES.admin]);
    const shop = await queries.updateShop({ id: parsed.data.shopId, active: parsed.data.active });
    revalidatePath(ROUTES.adminShops);
    return ok(shop);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update the shop.");
  }
}
