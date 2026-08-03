import type { OrderStatus } from "@/constants/status";

/**
 * Badge tones used by the status/payment chips. Kept as a local union so these
 * constants stay decoupled from the `Badge` UI component (they happen to match
 * `Badge`'s `tone` variants).
 */
export type OrderStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

/**
 * Every order status, in display order. Mirrors the DB enum (single source:
 * `ORDER_STATUS` in `@/constants/status`).
 */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

/**
 * Customer-facing status labels. The capstone proposal names statuses
 * differently than the DB enum — "To Pack" = confirmed, "Ready for Pickup" =
 * processing — so the mapping is documented here instead of changing the schema.
 */
export const STATUS_LABEL_MAP: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "To Pack",
  processing: "Ready for Pickup",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Badge tone per status — colour is always paired with the label (WCAG). */
export const STATUS_TONE_MAP: Record<OrderStatus, OrderStatusTone> = {
  pending: "info",
  confirmed: "info",
  processing: "warning",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  refunded: "neutral",
};

/** Forward fulfilment steps rendered by the order timeline (terminal states excluded). */
export const ORDER_TIMELINE_STEPS: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

/** States from which a buyer may cancel their own order (DB allows any; the action enforces this). */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
];

export function getOrderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL_MAP[status];
}

export function getOrderStatusTone(status: OrderStatus): OrderStatusTone {
  return STATUS_TONE_MAP[status];
}
