import { z } from "zod";

import { STOCK_ADJUSTMENT_REASON } from "@/features/inventory/constants/inventory.constants";

/**
 * Only the reasons a seller/admin may pick manually — `initial_stock`,
 * `sale`, and `cancellation_restock` are system-driven only and rejected by
 * the `adjust_stock` RPC if submitted here.
 */
export const stockAdjustmentReasonSchema = z.enum([
  STOCK_ADJUSTMENT_REASON.restock,
  STOCK_ADJUSTMENT_REASON.correction,
  STOCK_ADJUSTMENT_REASON.shrinkage,
  STOCK_ADJUSTMENT_REASON.other,
]);

/** Payload for a manual stock change from the Inventory dashboard. */
export const adjustStockSchema = z
  .object({
    productId: z.uuid(),
    delta: z.coerce
      .number()
      .int("Enter a whole number.")
      .refine((value) => value !== 0, "Adjustment must not be zero."),
    reason: stockAdjustmentReasonSchema,
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) => value.reason !== "other" || Boolean(value.note),
    { message: "Add a note explaining this adjustment.", path: ["note"] },
  );

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
