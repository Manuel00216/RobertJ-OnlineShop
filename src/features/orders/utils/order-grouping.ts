import type { Order } from "@/features/orders/types/order.types";

/**
 * Per-order membership info for a multi-seller checkout group, computed from
 * whatever page of orders is already in hand (no extra query) —
 * `checkoutGroupId` is already on the `Order` domain model. `isPrimary` marks
 * exactly one order per group (the first one encountered in the input array)
 * as the one that should own the shared payment action; every other member
 * points back at it via `primaryOrderNumber`.
 */
export interface OrderGroupInfo {
  isPrimary: boolean;
  groupSize: number;
  primaryOrderNumber: string;
}

/** Computes `OrderGroupInfo` for every grouped order in `orders`, keyed by order id. Ungrouped orders (`checkoutGroupId === null`) are omitted. */
export function computeOrderGroupInfo(orders: readonly Order[]): Map<string, OrderGroupInfo> {
  const groups = new Map<string, { size: number; primaryId: string; primaryOrderNumber: string }>();

  for (const order of orders) {
    if (!order.checkoutGroupId) continue;
    const existing = groups.get(order.checkoutGroupId);
    if (existing) {
      existing.size += 1;
    } else {
      groups.set(order.checkoutGroupId, {
        size: 1,
        primaryId: order.id,
        primaryOrderNumber: order.orderNumber,
      });
    }
  }

  const result = new Map<string, OrderGroupInfo>();
  for (const order of orders) {
    if (!order.checkoutGroupId) continue;
    const group = groups.get(order.checkoutGroupId);
    if (!group) continue;
    result.set(order.id, {
      isPrimary: group.primaryId === order.id,
      groupSize: group.size,
      primaryOrderNumber: group.primaryOrderNumber,
    });
  }
  return result;
}
