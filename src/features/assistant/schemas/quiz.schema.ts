import { z } from "zod";

import { occasionSchema } from "@/features/assistant/schemas/rule.schema";

/**
 * Buyer-facing Guided Selection query — every criterion is optional
 * independently (a buyer can skip occasion, size, or budget and still get
 * matches), same convention as `recommendationRuleSchema`'s nullable criteria.
 */
export const guidedSelectionQuerySchema = z
  .object({
    occasion: occasionSchema.optional(),
    size: z.string().trim().max(60).optional(),
    /** Major-unit pesos (not cents), same convention as `productListParamsSchema`. */
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      message: "Minimum budget must be less than or equal to maximum budget.",
      path: ["minPrice"],
    },
  );

export type GuidedSelectionQueryInput = z.infer<typeof guidedSelectionQuerySchema>;
