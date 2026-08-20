/** Every event type `get_buyer_activity_feed` can return. Deliberately does
 * NOT include "confirmed"/"processing" — `orders` has no timestamp column
 * for those transitions (see the RPC's migration). */
export type BuyerActivityEventType =
  | "order_placed"
  | "payment_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "receipt_submitted"
  | "payment_verified"
  | "payment_failed";

/** One row of the derived, read-only buyer activity feed. */
export interface BuyerActivityEvent {
  eventType: BuyerActivityEventType;
  orderId: string;
  orderNumber: string;
  occurredAt: string;
}
