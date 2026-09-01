"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import { getClientIp } from "@/lib/utils/request";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  assignProductShopSchema,
  createProductSchema,
  deleteProductImageSchema,
  updateProductSchema,
  uploadProductImageSchema,
} from "@/features/products/schemas/product.schema";
import type { Product, ProductImage } from "@/features/products/types/product.types";
import type { ProductSuggestion } from "@/lib/supabase/queries";

/**
 * Backs the header search's suggestions dropdown. Public — search is a
 * guest-accessible feature — so this intentionally does not call
 * `requireSessionUser()`, only a per-IP rate limit against abuse.
 */
export async function searchProductSuggestionsAction(
  term: string,
): Promise<ActionResult<ProductSuggestion[]>> {
  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`productSuggestions:${ip}`, 30, 60);
    const suggestions = await queries.searchProductSuggestions(term);
    return ok(suggestions);
  } catch {
    // Suggestions are a soft-fail affordance, not a critical action — an
    // empty list (dropdown just doesn't show) beats surfacing an error
    // under a search box.
    return ok([]);
  }
}

/**
 * Seller-only: sellers create and own marketplace products. Admin is
 * deliberately excluded here (`requireRole([USER_ROLES.seller])`, not
 * `DASHBOARD_ROLES`) rather than merely hidden in the UI — an admin account
 * must never become a product's `seller_id`. Admin's product capability is
 * limited to managing/moderating *existing* seller products (see
 * `updateProductAction`, `archiveProductAction`, `assignProductShopAction`),
 * never creating new ones.
 */
export async function createProductAction(
  _prevState: ActionResult<Product> | null,
  formData: FormData,
): Promise<ActionResult<Product>> {
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const seller = await queries.requireRole([USER_ROLES.seller]);
    const shopId = await queries.requireOwnShopId();
    const product = await queries.createProduct(parsed.data, seller.id, shopId);
    revalidatePath(ROUTES.adminInventory);
    revalidatePath(ROUTES.sellerInventory);
    revalidatePath(ROUTES.products);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerProducts);
    revalidatePath(ROUTES.home);
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
    revalidatePath(ROUTES.adminProducts);
    return ok(product);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not assign the shop.",
    );
  }
}

/**
 * Shared by seller (own product, or any product in a shop they belong to)
 * and admin (any product — moderation, not ownership: `owner = null` below
 * bypasses the ownership filter without ever writing the admin's id
 * anywhere). This is also how admin marks/unmarks an existing seller
 * product as Featured — `featured` is just another field here, gated the
 * same way as title/price/status, not specially restricted.
 */
export async function updateProductAction(
  _prevState: ActionResult<Product> | null,
  formData: FormData,
): Promise<ActionResult<Product>> {
  const parsed = updateProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const seller = await queries.requireRole(DASHBOARD_ROLES);
    // Defense-in-depth beyond RLS: a non-admin's own scope (their products,
    // or any product in a shop they belong to) is enforced again here.
    const owner =
      seller.role === USER_ROLES.admin
        ? null
        : { sellerId: seller.id, shopId: await queries.getOwnShopId(seller.id) };
    const product = await queries.updateProduct(parsed.data, owner);
    revalidatePath(ROUTES.adminInventory);
    revalidatePath(ROUTES.sellerInventory);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerProducts);
    revalidatePath(ROUTES.productDetail(product.slug));
    revalidatePath(ROUTES.home);
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
    const seller = await queries.requireRole(DASHBOARD_ROLES);
    const owner =
      seller.role === USER_ROLES.admin
        ? null
        : { sellerId: seller.id, shopId: await queries.getOwnShopId(seller.id) };
    await queries.archiveProduct(id, owner);
    revalidatePath(ROUTES.adminInventory);
    revalidatePath(ROUTES.sellerInventory);
    revalidatePath(ROUTES.products);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerProducts);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not archive the product.",
    );
  }
}

/**
 * Uploads and attaches one photo to a seller's own product (or, for an
 * admin, any product). Ownership is re-checked here beyond RLS/Storage
 * policy, same defense-in-depth precedent as `updateProductAction` — a
 * non-owner must not be able to spend a valid session uploading into
 * another seller's product folder even though the Storage policy would
 * also reject it.
 */
export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult<ProductImage>> {
  const parsed = uploadProductImageSchema.safeParse({
    productId,
    image: formData.get("image"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const seller = await queries.requireRole(DASHBOARD_ROLES);
    if (seller.role !== USER_ROLES.admin) {
      const owned = await queries.productBelongsToOwner(parsed.data.productId, {
        sellerId: seller.id,
        shopId: await queries.getOwnShopId(seller.id),
      });
      if (!owned) return fail("Product not found.");
    }

    const url = await queries.uploadProductImage(
      parsed.data.productId,
      parsed.data.image,
    );
    const image = await queries.addProductImage(parsed.data.productId, url);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerProducts);
    revalidatePath(ROUTES.products);
    return ok(image);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not upload the image.",
    );
  }
}

/** Same role/ownership shape as `uploadProductImageAction`. */
export async function deleteProductImageAction(
  imageId: string,
  productId: string,
): Promise<ActionResult<null>> {
  const parsed = deleteProductImageSchema.safeParse({ imageId, productId });
  if (!parsed.success) return fail("Invalid request.");

  try {
    const seller = await queries.requireRole(DASHBOARD_ROLES);
    const owner =
      seller.role === USER_ROLES.admin
        ? null
        : { sellerId: seller.id, shopId: await queries.getOwnShopId(seller.id) };
    await queries.deleteProductImage(parsed.data.imageId, owner);
    revalidatePath(ROUTES.adminProducts);
    revalidatePath(ROUTES.sellerProducts);
    revalidatePath(ROUTES.products);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not delete the image.",
    );
  }
}
