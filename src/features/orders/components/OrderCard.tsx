import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import type { ReactNode } from "react";

import { RJ_CARD, THEMED_CARD } from "@/components/ui/card";
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
  /** Renders through the Admin/Seller portal's tokens instead of the fixed rj-* palette — pass from portal call sites only (DashboardOrdersPanel, RecentOrdersCard); the Buyer order list omits it. */
  themed?: boolean;
}

/** Responsive order-list item: cover, order number, date, total, status badge. */
export function OrderCard({ order, href, subtitle, viewLabel, themed = false }: OrderCardProps) {
  const cover = order.items.find((item) => item.imageUrl)?.imageUrl ?? null;
  const ink = themed ? "text-foreground" : "text-rj-black";
  const muted = themed ? "text-muted-foreground" : "text-rj-gray-600";
  const accent = themed ? "text-primary" : "text-rj-red-dark";
  const ring = themed ? "focus-visible:ring-ring/30" : "focus-visible:ring-rj-red/30";

  return (
    <Link
      href={href ?? ROUTES.orderDetail(order.id)}
      className={cn(
        themed ? THEMED_CARD : RJ_CARD,
        "group flex items-center gap-4 p-4 shadow-sm transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2",
        ring,
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
        <span
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl",
            themed ? "bg-muted" : "bg-rj-gray-100",
          )}
        >
          <Package className={cn("h-6 w-6", themed ? "text-muted-foreground" : "text-rj-gray-400")} aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {subtitle ? (
          <p className={cn("truncate text-[10px] font-bold uppercase tracking-wide", accent)}>
            {subtitle}
          </p>
        ) : null}
        <p className={cn("text-[13px] font-bold", ink)}>{order.orderNumber}</p>
        <p className={cn("mt-0.5 text-xs", muted)}>{formatDate(order.placedAt)}</p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <p className={cn("text-sm font-bold", ink)}>
          {formatCurrency(order.totalCents, order.currency)}
        </p>
        <OrderStatusBadge status={order.status} />
        {viewLabel ? (
          <span className={cn("flex items-center gap-0.5 text-xs font-semibold", accent)}>
            {viewLabel}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
