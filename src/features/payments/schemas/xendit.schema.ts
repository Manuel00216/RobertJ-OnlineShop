import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

export const createXenditEwalletPaymentSchema = z.object({
  orderId: uuidSchema,
  channelCode: z.enum(["GCASH", "PAYMAYA"]),
});

export const createXenditCardSessionSchema = z.object({
  orderId: uuidSchema,
});

/** Client passes only the server-issued checkout_group_id — never order ids. */
export const createXenditGroupEwalletPaymentSchema = z.object({
  checkoutGroupId: uuidSchema,
  channelCode: z.enum(["GCASH", "PAYMAYA"]),
});

export const createXenditGroupCardSessionSchema = z.object({
  checkoutGroupId: uuidSchema,
});

export type CreateXenditEwalletPaymentInput = z.infer<typeof createXenditEwalletPaymentSchema>;
export type CreateXenditCardSessionInput = z.infer<typeof createXenditCardSessionSchema>;
export type CreateXenditGroupEwalletPaymentInput = z.infer<typeof createXenditGroupEwalletPaymentSchema>;
export type CreateXenditGroupCardSessionInput = z.infer<typeof createXenditGroupCardSessionSchema>;
