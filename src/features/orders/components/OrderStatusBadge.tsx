import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/constants/status";
import {
  getOrderStatusLabel,
  getOrderStatusTone,
} from "@/features/orders/constants/order.constants";

/**
 * Order status pill. The customer-facing label is the primary signal; the tone
 * is secondary so colour is never the only differentiator (WCAG 2.2 AA).
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={getOrderStatusTone(status)}>
      {getOrderStatusLabel(status)}
    </Badge>
  );
}
