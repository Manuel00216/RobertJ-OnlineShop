import { formatDate } from "@/lib/utils/date";
import type { Order } from "@/features/orders/types/order.types";

import { OrderStatusBadge } from "./OrderStatusBadge";

/** Order detail header: order number, placed date, live status badge. */
export function OrderHeader({ order }: { order: Order }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
          Order
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-[1.05] text-rj-black md:text-4xl">
          {order.orderNumber}
        </h1>
        <p className="mt-1 text-xs text-rj-gray-600">
          Placed {formatDate(order.placedAt)}
        </p>
      </div>
      <OrderStatusBadge status={order.status} />
    </header>
  );
}
