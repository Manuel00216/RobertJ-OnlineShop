"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_ONLY_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  assignSellerShopSchema,
  demoteSellerToBuyerSchema,
  setUserActiveSchema,
} from "@/features/users/schemas/user.schema";

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
    // "layout" so this cascades to /admin/users/[id] too — a plain path-only
    // revalidation only invalidates that exact path, leaving the user's own
    // detail page showing a stale shop/role if the action was triggered from
    // there rather than the list.
    revalidatePath(ROUTES.adminUsers, "layout");
    revalidatePath(ROUTES.adminShops);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not assign the shop.",
    );
  }
}

/**
 * Reversibly demotes a seller back to buyer and drops their shop
 * membership (M3) — delegates to `queries.demoteSellerToBuyer`, which calls
 * the `admin_demote_seller_to_buyer` RPC (the sole write path; that RPC
 * itself re-checks admin authorization and rejects any non-seller target,
 * mirroring `assignSellerShopAction`'s posture). Historical products/orders
 * are untouched; promoting the account back to Seller later restores full
 * seller capability.
 */
export async function demoteSellerToBuyerAction(
  userId: string,
): Promise<ActionResult<null>> {
  const parsed = demoteSellerToBuyerSchema.safeParse({ userId });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const admin = await queries.requireRole(ADMIN_ONLY_ROLES);
    await queries.requireRateLimit(`demoteSellerToBuyer:${admin.id}`, 20, 60);
    await queries.demoteSellerToBuyer(parsed.data.userId);
    revalidatePath(ROUTES.adminUsers, "layout");
    revalidatePath(ROUTES.adminShops);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not demote this seller to buyer.",
    );
  }
}

/**
 * Activates/deactivates a buyer or seller — delegates to
 * `queries.setUserActive`, which calls the `admin_set_user_active` RPC (the
 * sole write path; see that RPC's comment for why a plain client update
 * can't do this). The RPC itself rejects self-targeting and any
 * `role = 'admin'` target, so those cases surface as a friendly error here
 * rather than needing a duplicate check in this layer.
 */
export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  const parsed = setUserActiveSchema.safeParse({ userId, isActive });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const admin = await queries.requireRole(ADMIN_ONLY_ROLES);
    await queries.requireRateLimit(`setUserActive:${admin.id}`, 20, 60);
    await queries.setUserActive(parsed.data.userId, parsed.data.isActive);
    revalidatePath(ROUTES.adminUsers, "layout");
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update this account's status.",
    );
  }
}
