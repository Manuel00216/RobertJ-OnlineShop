import type { BuyerActivityEventType } from "@/features/notifications/types/notification.types";

/** Copy + icon per event type, keyed on the exact strings `get_buyer_activity_feed` returns. */
export const ACTIVITY_EVENT_COPY: Record<
  BuyerActivityEventType,
  { icon: string; label: (orderNumber: string) => string }
> = {
  order_placed: {
    icon: "🧾",
    label: (orderNumber) => `Order ${orderNumber} was placed.`,
  },
  payment_confirmed: {
    icon: "💰",
    label: (orderNumber) => `Payment confirmed for order ${orderNumber}.`,
  },
  order_shipped: {
    icon: "🚚",
    label: (orderNumber) => `Order ${orderNumber} has shipped.`,
  },
  order_delivered: {
    icon: "📦",
    label: (orderNumber) => `Order ${orderNumber} was delivered.`,
  },
  order_cancelled: {
    icon: "✕",
    label: (orderNumber) => `Order ${orderNumber} was cancelled.`,
  },
  receipt_submitted: {
    icon: "🧷",
    label: (orderNumber) => `Receipt submitted for order ${orderNumber} — awaiting verification.`,
  },
  payment_verified: {
    icon: "✅",
    label: (orderNumber) => `Payment verified for order ${orderNumber}.`,
  },
  payment_failed: {
    icon: "⚠️",
    label: (orderNumber) => `Payment could not be verified for order ${orderNumber}.`,
  },
};
