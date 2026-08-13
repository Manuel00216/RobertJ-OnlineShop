"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  assignProductShopSchema,
  createProductSchema,
  updateProductSchema,
} from "@/features/products/schemas/product.schema";
import type { Product } from "@/features/products/types/product.types";

export async function createProductAction(
  _prevState: ActionResult<Product> | null,
  formData: FormData,
): Promise<ActionResult<Product>> {
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const seller = await queries.requireRole(DASHBOARD_ROLES);

    // The shop is always server-resolved, never taken from the client
    // submission as-is: a seller's own shop is looked up via shop_users; an
    // admin must have explicitly picked one (parsed.data.shopId, validated
    // here, not trusted blindly — RLS would reject a mismatched id anyway,
    // but this gives a friendly error instead of a raw database failure).
    const shopId =
      seller.role === USER_ROLES.admin
        ? parsed.data.shopId
        : await queries.requireOwnShopId();

    if (!shopId) {
      return fail("Select which shop this product belongs to.");
    }

    const product = await queries.createProduct(parsed.data, seller.id, shopId);
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.products);
    revalidatePath(ROUTES.dashboardProducts);
    return ok(product);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not create the product.",
    );
  }
}

/** Admin-only: assign a shop to a legacy/unassigned product. */
export async function assignProductShopAction(
  productId: string,
  shopId: string,
): Promise<ActionResult<Product>> {
  const parsed = assignProductShopSchema.safeParse({ productId, shopId });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole([USER_ROLES.admin]);
    const product = await queries.assignProductShop(
      parsed.data.productId,
      parsed.data.shopId,
    );
    revalidatePath(ROUTES.dashboardProducts);
    return ok(product);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not assign the shop.",
    );
  }
}

export async function updateProductAction(
  _prevState: ActionResult<Product> | null,
  formData: FormData,
): Promise<ActionResult<Product>> {
  const parsed = updateProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRole(DASHBOARD_ROLES);
    const product = await queries.updateProduct(parsed.data);
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.productDetail(product.slug));
    return ok(product);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the product.",
    );
  }
}

export async function archiveProductAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await queries.requireRole(DASHBOARD_ROLES);
    await queries.archiveProduct(id);
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.products);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not archive the product.",
    );
  }
}
