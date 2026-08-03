import { z } from "zod";

import { ORDER_STATUS, type OrderStatus } from "@/constants/status";
import {
  paginationSchema,
  uuidSchema,
} from "@/lib/validations/common.schema";

/** All order statuses as a Zod enum (single source: `ORDER_STATUS`). */
const orderStatusValues = Object.values(ORDER_STATUS) as [
  OrderStatus,
  ...OrderStatus[],
];
export const orderStatusSchema = z.enum(orderStatusValues);

/** Validates and normalises search params for the buyer order listing. */
export const buyerOrderListParamsSchema = paginationSchema.extend({
  /** Order-ID search; capped well under the real order_number length. */
  search: z.string().trim().min(1).max(40).optional(),
  status: orderStatusSchema.optional(),
});

/** Payload for cancelling one of the buyer's own orders. */
export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
});

export type BuyerOrderListParamsInput = z.input<typeof buyerOrderListParamsSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
