import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** Payload for saving/removing one product from the signed-in user's wishlist. */
export const toggleWishlistSchema = z.object({
  productId: uuidSchema,
  save: z.boolean(),
});

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;
