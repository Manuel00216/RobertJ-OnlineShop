"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { toggleWishlistSchema } from "@/features/wishlist/schemas/wishlist.schema";

/**
 * Saves or removes one product from the signed-in user's wishlist.
 * `requireSessionUser` throws for a guest; the client component that calls
 * this never actually does (it redirects to sign-in first), but the guard
 * stays here too since a Server Action must never trust the client alone.
 */
export async function toggleWishlistAction(
  productId: string,
  save: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = toggleWishlistSchema.safeParse({ productId, save });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireSessionUser();
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
