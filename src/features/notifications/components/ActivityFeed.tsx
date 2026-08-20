import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { formatDateTime } from "@/lib/utils/date";
import { ACTIVITY_EVENT_COPY } from "@/features/notifications/constants/notification.constants";
import type { BuyerActivityEvent } from "@/features/notifications/types/notification.types";

export interface ActivityFeedProps {
  events: BuyerActivityEvent[];
}

/** Read-only order/payment activity list — see `get_buyer_activity_feed`. */
export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-rj-gray-200 p-10 text-center text-sm text-rj-gray-600">
        No activity yet — updates on your orders and payments will show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event, index) => {
        const copy = ACTIVITY_EVENT_COPY[event.eventType];
        return (
          <li
            key={`${event.orderId}-${event.eventType}-${index}`}
            className="flex items-start gap-3 rounded-2xl border border-rj-gray-100 bg-rj-white p-4"
          >
            <span className="text-xl" aria-hidden="true">
              {copy.icon}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={ROUTES.orderDetail(event.orderId)}
                className="text-sm font-medium text-rj-black hover:underline"
              >
                {copy.label(event.orderNumber)}
              </Link>
              <p className="mt-0.5 text-xs text-rj-gray-400">
                {formatDateTime(event.occurredAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
