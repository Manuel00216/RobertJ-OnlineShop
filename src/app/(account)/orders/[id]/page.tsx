import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RJ_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { BuyAgainButton } from "@/features/orders/components/BuyAgainButton";
import { CancelOrderButton } from "@/features/orders/components/CancelOrderButton";
import { OrderHeader } from "@/features/orders/components/OrderHeader";
import { OrderItemsList } from "@/features/orders/components/OrderItemsList";
import { OrderSummary } from "@/features/orders/components/OrderSummary";
import { OrderTimeline } from "@/features/orders/components/OrderTimeline";
import { PaymentStatusBadge } from "@/features/orders/components/PaymentStatusBadge";
import { ShippingAddressCard } from "@/features/orders/components/ShippingAddressCard";
import { XenditPaymentOptions } from "@/features/payments/components/XenditPaymentOptions";
import { RequestReturnPanel } from "@/features/returns/components/RequestReturnPanel";
import { ReturnRequestStatusCard } from "@/features/returns/components/ReturnRequestStatusCard";
import {
  getActivePaymentForOrder,
  getBuyerOrder,
  getReturnEvidenceSignedUrl,
  getReturnRequestForOrder,
  getShopNamesBySellerIds,
  listReviewedOrderItemIds,
  requireSessionUser,
} from "@/lib/supabase/queries";
import { ORDER_STATUS } from "@/constants/status";
import { USER_ROLES } from "@/constants/roles";

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

  // Same resolution as the catalog/PDP (see ProductGrid.tsx's toTileItem):
  // a real shop name when the seller belongs to one, else the seller's own
  // name only if `seller_id` actually resolves to a `seller` account —
  // never an admin's or a demoted account's personal name.
  const shopNames = await getShopNamesBySellerIds([order.sellerId]).catch(
    () => new Map<string, string>(),
  );
  const shopName =
    shopNames.get(order.sellerId) ??
    (order.sellerRole === USER_ROLES.seller ? order.sellerName : null);

  // Pending: shows Xendit payment options (or a "continue to payment" link
  // if an attempt is already in flight). Failed: carries the failure reason,
  // shown in the Payment card below. Paid needs neither — PaymentStatusBadge
  // already reflects it.
  const activePayment =
    order.paymentStatus === "pending" || order.paymentStatus === "failed"
      ? await getActivePaymentForOrder(order.id)
      : null;

  const resumableCheckoutUrl =
    activePayment?.paymentMethodType === "xendit" &&
    activePayment.status === "pending" &&
    activePayment.checkoutUrl &&
    (!activePayment.expiresAt || new Date(activePayment.expiresAt) > new Date())
      ? activePayment.checkoutUrl
      : null;

  // "Write a Review" only applies to a delivered order, and only for items
  // the buyer hasn't already reviewed.
  const reviewedOrderItemIds =
    order.status === ORDER_STATUS.delivered
      ? await listReviewedOrderItemIds(order.items.map((item) => item.id)).catch(
          () => new Set<string>(),
        )
      : new Set<string>();
  const reviewableOrderItemIds =
    order.status === ORDER_STATUS.delivered
      ? new Set(
          order.items
            .map((item) => item.id)
            .filter((id) => !reviewedOrderItemIds.has(id)),
        )
      : undefined;

  // Whole-order return only in this UI (the RPC also supports a per-item
  // scope — see request_return — but a single "Request Return" entry point
  // matches the buyer-facing lifecycle this phase actually asked for).
  const returnRequest =
    order.status === ORDER_STATUS.delivered
      ? await getReturnRequestForOrder(order.id).catch(() => null)
      : null;
  const returnEvidenceUrl = returnRequest?.evidencePath
    ? await getReturnEvidenceSignedUrl(returnRequest.evidencePath).catch(() => null)
    : null;

  return (
    <article className="flex flex-col gap-8">
      <OrderHeader order={order} />
      <OrderTimeline status={order.status} />
      <div className="flex flex-wrap items-center gap-3">
        {order.cancellable ? (
          <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
        ) : null}
        <BuyAgainButton order={order} sellerName={shopName} />
      </div>

      {order.paymentStatus === "pending" ? (
        <section
          aria-label="Payment"
          className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
            Online Payment
          </h2>
          <p className="mt-1 text-xs text-rj-gray-600">
            Paying by Cash on Delivery? No action needed — {shopName ?? "the seller"} will
            mark it collected once received. Prefer to pay now instead?
          </p>
          <div className="mt-3">
            <XenditPaymentOptions orderId={order.id} existingCheckoutUrl={resumableCheckoutUrl} />
          </div>
        </section>
      ) : null}

      {order.status === ORDER_STATUS.delivered ? (
        returnRequest ? (
          <ReturnRequestStatusCard request={returnRequest} evidenceUrl={returnEvidenceUrl} />
        ) : (
          <RequestReturnPanel orderId={order.id} />
        )
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <OrderItemsList
            items={order.items}
            currency={order.currency}
            orderId={order.id}
            reviewableOrderItemIds={reviewableOrderItemIds}
          />
          <ShippingAddressCard address={order.shippingAddress} />
        </div>
        <div className="flex flex-col gap-6">
          <OrderSummary order={order} />
          <section
            aria-label="Payment and shop"
            className={cn(RJ_CARD, "p-5")}
          >
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
              Payment
            </h2>
            <div className="mt-3">
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            {order.paymentStatus === "failed" && activePayment?.failureReason ? (
              <p className="mt-3 border-t border-rj-gray-100 pt-3 text-xs text-rj-gray-600">
                <span className="font-semibold text-rj-black">Reason: </span>
                {activePayment.failureReason}
              </p>
            ) : null}
            {shopName ? (
              <p className="mt-3 border-t border-rj-gray-100 pt-3 text-xs text-rj-gray-600">
                Sold by{" "}
                <span className="font-semibold text-rj-black">{shopName}</span>
              </p>
            ) : null}
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
