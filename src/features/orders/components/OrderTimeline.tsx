import { Check } from "lucide-react";

import type { OrderStatus } from "@/constants/status";
import { cn } from "@/lib/utils/cn";
import {
  getOrderStatusLabel,
  ORDER_TIMELINE_STEPS,
} from "@/features/orders/constants/order.constants";

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "cancelled",
  "refunded",
]);

/**
 * Forward fulfilment stepper (Pending → … → Delivered) with `aria-current="step"`
 * on the live step. Cancelled/Refunded are terminal and render a single marker
 * instead of the forward steps.
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (TERMINAL_STATUSES.has(status)) {
    return (
      <section
        aria-label={`Order status: ${getOrderStatusLabel(status)}`}
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-rj-gray-100 p-5",
          status === "cancelled" ? "bg-danger/5" : "bg-rj-gray-50",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rj-white",
            status === "cancelled" ? "bg-rj-red-dark" : "bg-rj-gray-400",
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-rj-black">
            {getOrderStatusLabel(status)}
          </p>
          <p className="mt-0.5 text-xs text-rj-gray-600">
            {status === "cancelled"
              ? "This order was cancelled and will not be fulfilled."
              : "This order was refunded and is complete."}
          </p>
        </div>
      </section>
    );
  }

  const currentIndex = ORDER_TIMELINE_STEPS.indexOf(status);

  return (
    <section
      aria-label="Order progress"
      className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5"
    >
      <ol className="flex items-start">
        {ORDER_TIMELINE_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === ORDER_TIMELINE_STEPS.length - 1;
          return (
            <li
              key={step}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-2",
                isLast && "flex-none",
              )}
            >
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    index > 0
                      ? index <= currentIndex
                        ? "bg-rj-red"
                        : "bg-rj-gray-200"
                      : "bg-transparent",
                  )}
                />
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold",
                    isDone && "border-rj-red bg-rj-red text-white",
                    isCurrent &&
                      "border-rj-red bg-rj-red text-white ring-2 ring-rj-red/30",
                    !isDone && !isCurrent && "border-rj-gray-200 bg-rj-white text-rj-gray-400",
                  )}
                >
                  {isDone ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    isLast
                      ? "bg-transparent"
                      : index < currentIndex
                        ? "bg-rj-red"
                        : "bg-rj-gray-200",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-center text-[10px] font-semibold leading-tight",
                  isDone || isCurrent ? "text-rj-black" : "text-rj-gray-600",
                )}
              >
                {getOrderStatusLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
