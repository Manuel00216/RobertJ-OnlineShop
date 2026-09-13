import { z } from "zod";

/** Must match the `recommendation_occasion` Postgres enum exactly. */
export const OCCASIONS = [
  "casual",
  "formal",
  "work",
  "sportswear",
  "party",
  "wedding",
  "everyday",
] as const;

export const occasionSchema = z.enum(OCCASIONS);

/**
 * A rule's editable attributes. No budget field here — see the
 * `recommendation_rules` migration's header comment; budget is matched
 * against live price by the buyer-facing quiz, never stored on a rule.
 */
export const recommendationRuleSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  occasion: occasionSchema.optional(),
  size: z.string().trim().max(60).optional(),
});

export const updateRecommendationRuleSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid().optional(),
  occasion: occasionSchema.optional(),
  size: z.string().trim().max(60).optional(),
  active: z.boolean().optional(),
});

export const deleteRecommendationRuleSchema = z.object({
  id: z.uuid(),
});

export type RecommendationRuleFormInput = z.infer<typeof recommendationRuleSchema>;
export type UpdateRecommendationRuleInput = z.infer<typeof updateRecommendationRuleSchema>;
export type DeleteRecommendationRuleInput = z.infer<typeof deleteRecommendationRuleSchema>;
