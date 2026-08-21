import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RJ_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { OrderHeader } from "@/features/orders/components/OrderHeader";
import { OrderItemsList } from "@/features/orders/components/OrderItemsList";
import { OrderStatusControl } from "@/features/orders/components/OrderStatusControl";
import { OrderSummary } from "@/features/orders/components/OrderSummary";
import { OrderTimeline } from "@/features/orders/components/OrderTimeline";
import { PaymentStatusBadge } from "@/features/orders/components/PaymentStatusBadge";
import { ShippingAddressCard } from "@/features/orders/components/ShippingAddressCard";
import { getDashboardOrder } from "@/lib/supabase/queries";

interface DashboardOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DashboardOrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getDashboardOrder(id);
  return { title: order ? `${order.orderNumber} — Dashboard` : "Order not found" };
}

/**
 * Seller/admin order detail — same composition as the buyer-facing detail
 * page, swapping `getBuyerOrder` for the RLS-only `getDashboardOrder` and
 * `CancelOrderButton` for `OrderStatusControl`. No page-level role check
 * needed beyond `dashboard/layout.tsx`'s `requireRole(DASHBOARD_ROLES)` gate
 * — `getDashboardOrder` returns null for an order RLS doesn't expose to the
 * caller, which `notFound()` below handles identically to a missing id.
 */
export default async function DashboardOrderDetailPage({
  params,
}: DashboardOrderDetailPageProps) {
  const { id } = await params;
  const order = await getDashboardOrder(id);

  if (!order) notFound();

  return (
    <article className="flex flex-col gap-8">
      <OrderHeader order={order} />
      <OrderTimeline status={order.status} />
      <OrderStatusControl
        orderId={order.id}
        orderNumber={order.orderNumber}
        status={order.status}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <OrderItemsList items={order.items} currency={order.currency} />
          <ShippingAddressCard address={order.shippingAddress} />
        </div>
        <div className="flex flex-col gap-6">
          <OrderSummary order={order} />
          <section
            aria-label="Buyer and payment"
            className={cn(RJ_CARD, "p-5")}
          >
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
              Buyer
            </h2>
            <p className="mt-2 text-sm font-semibold text-rj-black">
              {order.buyerName ?? "Unknown buyer"}
            </p>
            <div className="mt-3 border-t border-rj-gray-100 pt-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
                Payment
              </h2>
              <div className="mt-2">
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {order.notes ? (
        <section
          aria-label="Order notes"
          className={cn(RJ_CARD, "bg-rj-gray-50 p-5")}
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
            Notes
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-rj-gray-600">
            {order.notes}
          </p>
        </section>
      ) : null}
    </article>
  );
}
