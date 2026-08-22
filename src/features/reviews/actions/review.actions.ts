"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { submitReviewSchema } from "@/features/reviews/schemas/review.schema";
import type { Review } from "@/features/reviews/types/review.types";

/**
 * Submits a verified-purchase review. Ownership + the delivered-order rule
 * are enforced server-side inside `submit_review` — this action only
 * validates shape and forwards the call. `orderId` rides along as a hidden
 * field purely so this can revalidate the right order detail page; it plays
 * no role in authorization.
 */
export async function submitReviewAction(
  prevState: ActionResult<Review> | undefined,
  formData: FormData,
): Promise<ActionResult<Review>> {
  const parsed = submitReviewSchema.safeParse({
    orderId: formData.get("orderId"),
    orderItemId: formData.get("orderItemId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireSessionUser();
    const review = await queries.submitReview(
      parsed.data.orderItemId,
      parsed.data.rating,
      parsed.data.comment ?? null,
    );
    revalidatePath(ROUTES.orderDetail(parsed.data.orderId), "layout");
    revalidatePath(ROUTES.productDetail(review.productId), "layout");
    return ok(review);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not submit your review.",
    );
  }
}
