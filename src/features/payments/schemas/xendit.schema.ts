import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

export const createXenditEwalletPaymentSchema = z.object({
  orderId: uuidSchema,
  channelCode: z.enum(["GCASH", "PAYMAYA"]),
});

export const createXenditCardSessionSchema = z.object({
  orderId: uuidSchema,
});

export type CreateXenditEwalletPaymentInput = z.infer<typeof createXenditEwalletPaymentSchema>;
export type CreateXenditCardSessionInput = z.infer<typeof createXenditCardSessionSchema>;
