import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

export const markCodPaymentCollectedSchema = z.object({
  orderId: uuidSchema,
});

export type MarkCodPaymentCollectedInput = z.infer<typeof markCodPaymentCollectedSchema>;
