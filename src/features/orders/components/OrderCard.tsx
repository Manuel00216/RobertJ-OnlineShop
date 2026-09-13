import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import type { ReactNode } from "react";

import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import type { Order } from "@/features/orders/types/order.types";

import { OrderStatusBadge } from "./OrderStatusBadge";

export interface OrderCardProps {
  order: Order;
  /** Overrides the default buyer-facing detail link — used by the dashboard list to point at `ROUTES.dashboardOrderDetail`. */
  href?: string;
  /** Small line under the order number — e.g. which shop this order belongs to. Only the order-confirmation page passes this today; every other caller is unaffected. */
  subtitle?: ReactNode;
  /** Explicit trailing "View Order"-style label, for contexts (order confirmation) where each card needs a clearly labeled action rather than relying on the whole card being a link. Omitted elsewhere — no visual change to the existing order-list/dashboard usage. */
  viewLabel?: string;
}

/** Responsive order-list item: cover, order number, date, total, status badge. */
export function OrderCard({ order, href, subtitle, viewLabel }: OrderCardProps) {
  const cover = order.items.find((item) => item.imageUrl)?.imageUrl ?? null;

  return (
    <Link
      href={href ?? ROUTES.orderDetail(order.id)}
      className={cn(
        RJ_CARD,
        "group flex items-center gap-4 p-4 shadow-sm transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30",
      )}
    >
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-rj-gray-100">
          <Package className="h-6 w-6 text-rj-gray-400" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {subtitle ? (
          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-rj-red-dark">
            {subtitle}
          </p>
        ) : null}
        <p className="text-[13px] font-bold text-rj-black">{order.orderNumber}</p>
        <p className="mt-0.5 text-xs text-rj-gray-600">{formatDate(order.placedAt)}</p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <p className="text-sm font-bold text-rj-black">
          {formatCurrency(order.totalCents, order.currency)}
        </p>
        <OrderStatusBadge status={order.status} />
        {viewLabel ? (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-rj-red-dark">
            {viewLabel}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
