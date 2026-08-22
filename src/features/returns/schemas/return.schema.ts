import { z } from "zod";

import { uuidSchema } from "@/lib/validations/common.schema";

/** Mirrors the payment-receipts bucket's own file_size_limit/allowed_mime_types
 * (the return-evidence photo is uploaded to the same bucket) so the UI fails
 * fast instead of round-tripping to Storage only to be rejected there. */
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const requestReturnSchema = z.object({
  orderId: uuidSchema,
  orderItemId: uuidSchema.optional(),
  reason: z
    .string()
    .trim()
    .min(1, "A reason is required.")
    .max(500, "Reason is too long."),
  // Optional: an empty file input submits a zero-byte File, not undefined —
  // normalize that to undefined before the size/type checks apply.
  evidence: z
    .instanceof(File)
    .optional()
    .transform((file) => (file && file.size > 0 ? file : undefined))
    .refine(
      (file) => !file || file.size <= MAX_EVIDENCE_BYTES,
      "Evidence photo must be 5MB or smaller.",
    )
    .refine(
      (file) => !file || ALLOWED_EVIDENCE_TYPES.includes(file.type),
      "Evidence photo must be a JPEG, PNG, or WebP image.",
    ),
});

export const respondToReturnSchema = z.object({
  returnId: uuidSchema,
  decision: z.enum(["accept", "reject"]),
  note: z.string().trim().max(500, "Note is too long.").optional(),
});

export const decideReturnSchema = z.object({
  returnId: uuidSchema,
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500, "Note is too long.").optional(),
});

export type RequestReturnInput = z.infer<typeof requestReturnSchema>;
export type RespondToReturnInput = z.infer<typeof respondToReturnSchema>;
export type DecideReturnInput = z.infer<typeof decideReturnSchema>;
