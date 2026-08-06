import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CancelOrderButton } from "@/features/orders/components/CancelOrderButton";
import { OrderHeader } from "@/features/orders/components/OrderHeader";
import { OrderItemsList } from "@/features/orders/components/OrderItemsList";
import { OrderSummary } from "@/features/orders/components/OrderSummary";
import { OrderTimeline } from "@/features/orders/components/OrderTimeline";
import { PaymentStatusBadge } from "@/features/orders/components/PaymentStatusBadge";
import { ShippingAddressCard } from "@/features/orders/components/ShippingAddressCard";
import { ReceiptUpload } from "@/features/payments/components/ReceiptUpload";
import {
  getActivePaymentForOrder,
  getBuyerOrder,
  requireSessionUser,
} from "@/lib/supabase/queries";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await requireSessionUser();
  const order = await getBuyerOrder(id, user.id);
  return { title: order ? order.orderNumber : "Order not found" };
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const user = await requireSessionUser();
  const order = await getBuyerOrder(id, user.id);

  if (!order) notFound();

  // Only relevant while payment is undecided — once paid/failed, the
  // PaymentStatusBadge below already reflects the outcome.
  const activePayment =
    order.paymentStatus === "pending" ? await getActivePaymentForOrder(order.id) : null;

  return (
    <article className="flex flex-col gap-8">
      <OrderHeader order={order} />
      <OrderTimeline status={order.status} />
      {order.cancellable ? (
        <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
      ) : null}

      {order.paymentStatus === "pending" ? (
        activePayment ? (
          <section
            aria-label="Payment"
            className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5"
          >
            <p className="text-sm font-semibold text-rj-black">
              Receipt submitted — awaiting verification.
            </p>
            <p className="mt-1 text-xs text-rj-gray-600">
              {order.sellerName ?? "The seller"} will confirm your payment shortly.
            </p>
          </section>
        ) : (
          <ReceiptUpload
            orderId={order.id}
            sellerName={order.sellerName}
            sellerPaymentQrUrl={order.sellerPaymentQrUrl}
          />
        )
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <OrderItemsList items={order.items} currency={order.currency} />
          <ShippingAddressCard address={order.shippingAddress} />
        </div>
        <div className="flex flex-col gap-6">
          <OrderSummary order={order} />
          <section
            aria-label="Payment and shop"
            className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5"
          >
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
              Payment
            </h2>
            <div className="mt-3">
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            {order.sellerName ? (
              <p className="mt-3 border-t border-rj-gray-100 pt-3 text-xs text-rj-gray-600">
                Sold by{" "}
                <span className="font-semibold text-rj-black">
                  {order.sellerName}
                </span>
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {order.notes ? (
        <section
          aria-label="Order notes"
          className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5"
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
