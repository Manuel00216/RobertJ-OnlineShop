"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROLES, USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  deleteRecommendationRuleSchema,
  recommendationRuleSchema,
  updateRecommendationRuleSchema,
} from "@/features/assistant/schemas/rule.schema";
import type { RecommendationRule } from "@/features/assistant/types/assistant.types";

/** Same shape/role gate as `updateProductAction` — admin (owner = null) moderates any product, a seller is scoped to their own (or their shop's). */
async function resolveOwner(): Promise<{ sellerId: string; shopId: string | null } | null> {
  const user = await queries.requireRole(DASHBOARD_ROLES);
  return user.role === USER_ROLES.admin
    ? null
    : { sellerId: user.id, shopId: await queries.getOwnShopId(user.id) };
}

function revalidateRulePaths() {
  revalidatePath(ROUTES.adminProducts);
  revalidatePath(ROUTES.sellerProducts);
}

/**
 * Creates a Guided Product Selection rule (DECISIONS.md ADR-009 — rule-based,
 * never AI/ML) for a product the caller owns (or, for admin, any product —
 * moderation, not ownership). The rule's own `seller_id`/`shop_id` are
 * resolved from the *product*, never the acting user, so an admin creating on
 * a seller's behalf never attributes the rule to themselves — same pattern
 * as `createProductVariantAction`.
 */
export async function createRecommendationRuleAction(
  input: unknown,
): Promise<ActionResult<RecommendationRule>> {
  const parsed = recommendationRuleSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const owner = await resolveOwner();
    const product = await queries.getProductOwnerInfo(parsed.data.productId, owner);
    const rule = await queries.createRecommendationRule(
      parsed.data.productId,
      product.sellerId,
      product.shopId,
      {
        variantId: parsed.data.variantId,
        occasion: parsed.data.occasion,
        size: parsed.data.size,
      },
    );
    revalidateRulePaths();
    return ok(rule);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create recommendation rule.");
  }
}

/** Updates a rule's match criteria/active flag. Ownership re-checked beyond RLS, same pattern as `updateProductVariantAction`. */
export async function updateRecommendationRuleAction(
  input: unknown,
): Promise<ActionResult<RecommendationRule>> {
  const parsed = updateRecommendationRuleSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const owner = await resolveOwner();
    const rule = await queries.updateRecommendationRule(parsed.data.id, owner, {
      variantId: parsed.data.variantId,
      occasion: parsed.data.occasion,
      size: parsed.data.size,
      active: parsed.data.active,
    });
    revalidateRulePaths();
    return ok(rule);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update recommendation rule.");
  }
}

/** Deletes a rule. No historical/financial dependency (unlike a variant), so this never needs a friendly FK-restrict message. */
export async function deleteRecommendationRuleAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = deleteRecommendationRuleSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const owner = await resolveOwner();
    await queries.deleteRecommendationRule(parsed.data.id, owner);
    revalidateRulePaths();
    return ok(null);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not delete recommendation rule.");
  }
}
