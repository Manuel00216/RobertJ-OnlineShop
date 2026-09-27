"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { toggleWishlistSchema } from "@/features/wishlist/schemas/wishlist.schema";

/**
 * Saves or removes one product from the signed-in user's wishlist. The
 * wishlist is buyer functionality, so this is gated to buyers (strict role
 * separation) — `requireRole` throws for a guest, seller, or admin. The
 * `wishlists` INSERT RLS is the authoritative backstop; DELETE stays open so a
 * role-changed account could still clear leftover rows if ever needed.
 */
export async function toggleWishlistAction(
  productId: string,
  save: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = toggleWishlistSchema.safeParse({ productId, save });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireRole([USER_ROLES.buyer]);
    if (parsed.data.save) {
      await queries.addWishlistItem(user.id, parsed.data.productId);
    } else {
      await queries.removeWishlistItem(user.id, parsed.data.productId);
    }
    revalidatePath(ROUTES.wishlist);
    return ok({ saved: parsed.data.save });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update your wishlist.",
    );
  }
}
