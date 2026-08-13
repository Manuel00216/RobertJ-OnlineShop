"use server";

import { revalidatePath } from "next/cache";

import { USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { assignSellerShopSchema } from "@/features/users/schemas/user.schema";

/**
 * Promotes a buyer to seller and/or (re)assigns their shop — the sole write
 * path for this, delegating to the `admin_assign_seller_shop` RPC via
 * `queries.assignSellerShop` (see that function's doc comment for why a
 * plain client update can't do this: RLS never exposes another user's
 * `profiles` row to an admin).
 */
export async function assignSellerShopAction(
  userId: string,
  shopId: string,
): Promise<ActionResult<null>> {
  const parsed = assignSellerShopSchema.safeParse({ userId, shopId });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const admin = await queries.requireRole([USER_ROLES.admin]);
    await queries.requireRateLimit(`assignSellerShop:${admin.id}`, 20, 60);
    await queries.assignSellerShop(parsed.data.userId, parsed.data.shopId);
    revalidatePath(ROUTES.adminUsers);
    revalidatePath(ROUTES.adminShops);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not assign the shop.",
    );
  }
}
