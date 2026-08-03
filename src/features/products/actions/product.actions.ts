"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
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
    const product = await queries.createProduct(parsed.data, seller.id);
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.products);
    return ok(product);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not create the product.",
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
