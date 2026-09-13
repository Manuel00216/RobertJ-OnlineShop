import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** One cart line to revalidate — a plain product, or a specific variant of one. */
export const cartAvailabilityLineSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
});

/** Payload for revalidating a cart's price/stock. Capped well above any realistic cart size. */
export const checkCartAvailabilitySchema = z.object({
  lines: z.array(cartAvailabilityLineSchema).max(100),
});

export type CartAvailabilityLineInput = z.infer<typeof cartAvailabilityLineSchema>;
export type CheckCartAvailabilityInput = z.infer<
  typeof checkCartAvailabilitySchema
>;

/** Payload for cart-anchored product lookups that only need product ids (recommendations, "find similar"). */
export const cartProductIdsSchema = z.object({
  productIds: z.array(uuidSchema).max(100),
});

// ============================================================================
// Authenticated persistent cart (Phase 2B). userId is never part of these
// schemas — it always comes from requireSessionUser() inside the action,
// never from client input.
// ============================================================================

/** Payload for `addToCartAction`. Same product + variant merges server-side (see queries.addCartItem). */
export const addCartItemSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  quantity: z.number().int().min(1).max(999),
});

/** Payload for `updateCartItemQuantityAction`. Sets the quantity outright, not a delta. */
export const updateCartItemQuantitySchema = z.object({
  cartItemId: uuidSchema,
  quantity: z.number().int().min(1).max(999),
});

/** Payload for `removeCartItemAction`. */
export const removeCartItemSchema = z.object({
  cartItemId: uuidSchema,
});

/** Payload for `removeManyCartItemsAction` — e.g. clearing exactly the items a checkout just placed. */
export const removeManyCartItemsSchema = z.object({
  cartItemIds: z.array(uuidSchema).max(100),
});

/** Payload for `mergeGuestCartAction` — one line per item the guest cart held at sign-in. */
export const mergeGuestCartSchema = z.object({
  items: z.array(addCartItemSchema).max(100),
});

export type AddCartItemFormInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemQuantityInput = z.infer<typeof updateCartItemQuantitySchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
export type RemoveManyCartItemsInput = z.infer<typeof removeManyCartItemsSchema>;
export type MergeGuestCartInput = z.infer<typeof mergeGuestCartSchema>;
