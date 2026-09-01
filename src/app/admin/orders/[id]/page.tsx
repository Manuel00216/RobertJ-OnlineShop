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
import { ReturnRequestStatusCard } from "@/features/returns/components/ReturnRequestStatusCard";
import { RespondToReturnPanel } from "@/features/returns/components/RespondToReturnPanel";
import {
  getDashboardOrder,
  getReturnEvidenceSignedUrl,
  getReturnRequestForOrder,
} from "@/lib/supabase/queries";
import { RETURN_STATUS } from "@/constants/status";

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AdminOrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getDashboardOrder(id);
  return { title: order ? `${order.orderNumber} — Admin Portal` : "Order not found" };
}

/** Admin Portal order detail — same composition as the seller dashboard's order detail page, moved to `/admin`. */
export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;
  const order = await getDashboardOrder(id);

  if (!order) notFound();

  const returnRequest = await getReturnRequestForOrder(order.id).catch(() => null);
  const returnEvidenceUrl = returnRequest?.evidencePath
    ? await getReturnEvidenceSignedUrl(returnRequest.evidencePath).catch(() => null)
    : null;

  return (
    <article className="flex flex-col gap-8 p-5 lg:p-7">
      <OrderHeader order={order} />
      <OrderTimeline status={order.status} />
      <OrderStatusControl orderId={order.id} orderNumber={order.orderNumber} status={order.status} />

      {returnRequest ? (
        <div className="flex flex-col gap-3">
          <ReturnRequestStatusCard request={returnRequest} evidenceUrl={returnEvidenceUrl} />
          {returnRequest.status === RETURN_STATUS.pending ? (
            <RespondToReturnPanel returnId={returnRequest.id} />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <OrderItemsList items={order.items} currency={order.currency} />
          <ShippingAddressCard address={order.shippingAddress} />
        </div>
        <div className="flex flex-col gap-6">
          <OrderSummary order={order} />
          <section aria-label="Buyer and payment" className={cn(RJ_CARD, "p-5")}>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">Buyer</h2>
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
        <section aria-label="Order notes" className={cn(RJ_CARD, "bg-rj-gray-50 p-5")}>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">Notes</h2>
          <p className="mt-2 text-sm leading-relaxed text-rj-gray-600">{order.notes}</p>
        </section>
      ) : null}
    </article>
  );
}
