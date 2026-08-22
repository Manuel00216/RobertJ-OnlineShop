import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
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
      <EmptyState
        title="No activity yet"
        description="Updates on your orders and payments will show up here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event, index) => {
        const copy = ACTIVITY_EVENT_COPY[event.eventType];
        return (
          <li
            key={`${event.orderId}-${event.eventType}-${index}`}
            className={cn(RJ_CARD, "flex items-start gap-3 p-4")}
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
