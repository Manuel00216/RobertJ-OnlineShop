import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** Payload for writing a verified-purchase review. `orderId` is carried as a
 * hidden field purely so the action knows which page to revalidate. */
export const submitReviewSchema = z.object({
  orderId: uuidSchema,
  orderItemId: uuidSchema,
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
