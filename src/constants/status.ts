import type { Enums } from "@/lib/supabase/database.types";

/**
 * These unions are derived from the database enums, not redeclared. If a value
 * is added in a migration and the types are regenerated, anything that fails to
 * handle it stops compiling.
 */
export type ProductStatus = Enums<"product_status">;
export type ProductCondition = Enums<"product_condition">;
export type PaymentStatus = Enums<"payment_status">;
export type OrderStatus = Enums<"order_status">;

export const PRODUCT_STATUS = {
  draft: "draft",
  active: "active",
  sold: "sold",
  archived: "archived",
} as const satisfies Record<string, ProductStatus>;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold out",
  archived: "Archived",
};

export const PRODUCT_CONDITION = {
  new: "new",
  likeNew: "like_new",
  good: "good",
  fair: "fair",
  poor: "poor",
} as const satisfies Record<string, ProductCondition>;

export const PRODUCT_CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

/** Payment lifecycle. Driven by the payment provider, never by the client. */
export const PAYMENT_STATUS = {
  pending: "pending",
  paid: "paid",
  failed: "failed",
  refunded: "refunded",
  partiallyRefunded: "partially_refunded",
} as const satisfies Record<string, PaymentStatus>;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

/** Fulfilment lifecycle. Advanced by the seller. */
export const ORDER_STATUS = {
  pending: "pending",
  confirmed: "confirmed",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
} as const satisfies Record<string, OrderStatus>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Order states that can no longer transition. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.delivered,
  ORDER_STATUS.cancelled,
  ORDER_STATUS.refunded,
];
