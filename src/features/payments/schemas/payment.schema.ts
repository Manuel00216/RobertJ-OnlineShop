import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** Mirrors the payment-receipts bucket's own file_size_limit/allowed_mime_types
 * (see the storage migration) so the UI fails fast instead of round-tripping
 * to Storage only to be rejected there. */
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const submitQrPaymentSchema = z.object({
  orderId: uuidSchema,
  receipt: z
    .instanceof(File, { message: "A receipt image is required." })
    .refine((file) => file.size > 0, "A receipt image is required.")
    .refine(
      (file) => file.size <= MAX_RECEIPT_BYTES,
      "Receipt must be 5MB or smaller.",
    )
    .refine(
      (file) => ALLOWED_RECEIPT_TYPES.includes(file.type),
      "Receipt must be a JPEG, PNG, or WebP image.",
    ),
});

export const verifyPaymentSchema = z
  .object({
    paymentId: uuidSchema,
    decision: z.enum(["paid", "failed"]),
    reason: z.string().trim().max(500, "Reason is too long.").optional(),
  })
  .refine(
    (data) => data.decision !== "failed" || (data.reason && data.reason.length > 0),
    { message: "A reason is required when rejecting a payment.", path: ["reason"] },
  );

export type SubmitQrPaymentInput = z.infer<typeof submitQrPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
