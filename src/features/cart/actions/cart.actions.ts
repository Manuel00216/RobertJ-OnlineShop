"use server";

import { fail, fromZodError, ok } from "@/lib/utils/result";
import { getClientIp } from "@/lib/utils/request";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  addCartItemSchema,
  cartProductIdsSchema,
  checkCartAvailabilitySchema,
  mergeGuestCartSchema,
  removeCartItemSchema,
  removeManyCartItemsSchema,
  updateCartItemQuantitySchema,
} from "@/features/cart/schemas/cart.schema";
import { uuidSchema } from "@/lib/validations/common.schema";
import type {
  CartAvailabilityEntry,
  CartLineItem,
  MergeGuestCartResult,
} from "@/lib/supabase/queries";
import type { Product } from "@/features/products/types/product.types";

/**
 * Revalidates a client-side cart's price/stock against the live database —
 * a non-variant line checks `products`, a variant line checks
 * `product_variants` + variant-level `inventory` (see
 * `queries.checkCartAvailability`). Public — the cart is a guest-accessible
 * feature (ADR-013), so this intentionally does not call `requireSessionUser()`.
 */
export async function checkCartAvailabilityAction(
  lines: { productId: string; variantId?: string }[],
): Promise<ActionResult<CartAvailabilityEntry[]>> {
  const parsed = checkCartAvailabilitySchema.safeParse({ lines });
  if (!parsed.success) {
    return fail("Could not check item availability.");
  }

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`cartAvailability:${ip}`, 20, 60);
    const availability = await queries.checkCartAvailability(parsed.data.lines);
    return ok(availability);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not check item availability.",
    );
  }
}

/**
 * Cart-page "You may also like" — same-category suggestions anchored on the
 * cart's contents (see `queries.listCartRecommendations`). Public, same as
 * the availability check: the cart is a guest-accessible feature (ADR-013).
 */
export async function getCartRecommendationsAction(
  productIds: string[],
): Promise<ActionResult<Product[]>> {
  const parsed = cartProductIdsSchema.safeParse({ productIds });
  if (!parsed.success) {
    return fail("Could not load recommendations.");
  }

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`cartRecommendations:${ip}`, 20, 60);
    const products = await queries.listCartRecommendations(
      parsed.data.productIds,
    );
    return ok(products);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load recommendations.",
    );
  }
}

/**
 * Cart-row "Find Similar" — same-category matches for one line item, shown
 * inline in an expandable panel (see `queries.listSimilarProducts`). Public,
 * same as the other cart reads: the cart is a guest-accessible feature
 * (ADR-013).
 */
export async function getSimilarProductsAction(
  productId: string,
): Promise<ActionResult<Product[]>> {
  const parsed = uuidSchema.safeParse(productId);
  if (!parsed.success) {
    return fail("Could not load similar products.");
  }

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`similarProducts:${ip}`, 30, 60);
    const products = await queries.listSimilarProducts(parsed.data);
    return ok(products);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load similar products.",
    );
  }
}

// ============================================================================
// Authenticated persistent cart (Phase 2B). Every action below resolves the
// caller via `requireSessionUser()` and passes only `user.id` into the
// service layer — never a client-supplied id. Guest carts (CartProvider/
// localStorage) are entirely untouched by these; nothing wires them up yet.
// ============================================================================

/** Shared guard for every cart mutation below — mirrors `guardAddressMutation`. */
async function guardCartMutation() {
  const user = await queries.requireSessionUser();
  await queries.requireRateLimit(`cart:${user.id}`, 20, 60);
  return user;
}

/** The signed-in user's persistent cart, with live-joined display data. */
export async function getMyCartAction(): Promise<ActionResult<CartLineItem[]>> {
  try {
    const user = await queries.requireSessionUser();
    const items = await queries.listCartItems(user.id);
    return ok(items);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not load your cart.",
    );
  }
}

export async function addToCartAction(
  input: unknown,
): Promise<ActionResult<CartLineItem>> {
  const parsed = addCartItemSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardCartMutation();
    const item = await queries.addCartItem(user.id, parsed.data);
    return ok(item);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not add this item to your cart.",
    );
  }
}

export async function updateCartItemQuantityAction(
  input: unknown,
): Promise<ActionResult<CartLineItem>> {
  const parsed = updateCartItemQuantitySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardCartMutation();
    const item = await queries.updateCartItemQuantity(
      user.id,
      parsed.data.cartItemId,
      parsed.data.quantity,
    );
    return ok(item);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update this item.",
    );
  }
}

export async function removeCartItemAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = removeCartItemSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardCartMutation();
    await queries.removeCartItem(user.id, parsed.data.cartItemId);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not remove this item.",
    );
  }
}

/** Removes several lines at once — e.g. clearing exactly the items a checkout just placed. */
export async function removeManyCartItemsAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = removeManyCartItemsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardCartMutation();
    await queries.removeManyCartItems(user.id, parsed.data.cartItemIds);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not remove these items.",
    );
  }
}

export async function clearCartAction(): Promise<ActionResult<null>> {
  try {
    const user = await guardCartMutation();
    await queries.clearCart(user.id);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not clear your cart.",
    );
  }
}

/**
 * Folds a guest cart into the signed-in user's persistent cart at sign-in —
 * called once by `CartProvider` when it detects a non-empty guest bucket for
 * an identity it just resolved as authenticated. See `queries.mergeGuestCart`
 * for why this doesn't re-check stock/availability itself.
 */
export async function mergeGuestCartAction(
  input: unknown,
): Promise<ActionResult<MergeGuestCartResult>> {
  const parsed = mergeGuestCartSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardCartMutation();
    const result = await queries.mergeGuestCart(user.id, parsed.data.items);
    return ok(result);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not merge your cart.",
    );
  }
}
