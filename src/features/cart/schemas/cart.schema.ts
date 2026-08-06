import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** Payload for revalidating a cart's price/stock. Capped well above any realistic cart size. */
export const checkCartAvailabilitySchema = z.object({
  productIds: z.array(uuidSchema).max(100),
});

export type CheckCartAvailabilityInput = z.infer<
  typeof checkCartAvailabilitySchema
>;
