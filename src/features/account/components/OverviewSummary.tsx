import Link from "next/link";

import type { OrderStatus } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import {
  getOrderStatusLabel,
  ORDER_TIMELINE_STEPS,
} from "@/features/orders/constants/order.constants";

/** Statuses surfaced as count cards on the overview (refunded is excluded). */
const OVERVIEW_STATUSES: readonly OrderStatus[] = [
  ...ORDER_TIMELINE_STEPS,
  "cancelled",
];

/** Count cards linking into the filtered order history. */
export function OverviewSummary({
  statusCounts,
}: {
  statusCounts: Record<OrderStatus, number>;
}) {
  return (
    <section
      aria-label="Orders by status"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {OVERVIEW_STATUSES.map((status) => (
        <Link
          key={status}
          href={`${ROUTES.orders}?status=${status}`}
          className="group rounded-2xl border border-rj-gray-100 bg-rj-white p-4 transition-all hover:border-rj-black hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        >
          <p className="text-2xl font-bold text-rj-black">{statusCounts[status]}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-rj-gray-600">
            {getOrderStatusLabel(status)}
          </p>
        </Link>
      ))}
    </section>
  );
}
