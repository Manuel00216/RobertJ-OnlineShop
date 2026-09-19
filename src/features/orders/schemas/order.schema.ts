import { z } from "zod";

import { ORDER_STATUS, type OrderStatus } from "@/constants/status";
import { ORDER_LIFECYCLE_TABS, type LifecycleTab } from "@/features/orders/constants/order-lifecycle.constants";
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

/** All lifecycle tabs as a Zod enum (single source: `ORDER_LIFECYCLE_TABS`). "All" isn't listed here — it's simply the absence of `tab`. */
const lifecycleTabValues = ORDER_LIFECYCLE_TABS as [LifecycleTab, ...LifecycleTab[]];
export const lifecycleTabSchema = z.enum(lifecycleTabValues);

/** Validates and normalises search params for the buyer order listing. */
export const buyerOrderListParamsSchema = paginationSchema.extend({
  /** Order-ID search; capped well under the real order_number length. */
  search: z.string().trim().min(1).max(40).optional(),
  status: orderStatusSchema.optional(),
  /** Shopee-style lifecycle tab (`OrderLifecycleTabs`, buyer `/orders` only) — named `tab` in the URL, distinct from the raw `status` chip filter. */
  tab: lifecycleTabSchema.optional(),
});

/** Payload for cancelling one of the buyer's own orders. */
export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Please select or enter a reason.")
    .max(500, "Reason must be 500 characters or fewer."),
});

/** Payload for a seller/admin advancing (or cancelling) an order from the dashboard. */
export const advanceOrderStatusSchema = z.object({
  orderId: uuidSchema,
  newStatus: orderStatusSchema,
});

export type BuyerOrderListParamsInput = z.input<typeof buyerOrderListParamsSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AdvanceOrderStatusInput = z.infer<typeof advanceOrderStatusSchema>;
