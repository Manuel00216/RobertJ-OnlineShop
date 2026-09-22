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
import { SellerShopRow } from "@/features/orders/components/SellerShopRow";
import { paymentMethodLabel } from "@/features/orders/utils/payment-method-label";
// Imported directly, not the feature barrel — same reason as
// `OrderCardActions.tsx`: the barrel also re-exports `PaymentsList`, which
// pulls in the server-only Xendit client.
import { PaymentRecoveryPanel } from "@/features/payments/components/PaymentRecoveryPanel";
import { RequestReturnPanel } from "@/features/returns/components/RequestReturnPanel";
import { ReturnRequestStatusCard } from "@/features/returns/components/ReturnRequestStatusCard";
import {
  getActivePaymentForOrder,
  getBuyerOrder,
  getOrderIdsForCheckoutGroup,
  getReturnEvidenceSignedUrl,
  getReturnRequestForOrder,
  getShopMembershipBySellerIds,
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
  // never an admin's or a demoted account's personal name. Uses the
  // membership variant (not `getShopNamesBySellerIds`) because "View Shop"
  // needs the real `shopId` to filter the catalog, not just a display name.
  const shopMembership = await getShopMembershipBySellerIds([order.sellerId]).catch(
    () => new Map<string, { shopId: string; shopName: string }>(),
  );
  const membership = shopMembership.get(order.sellerId) ?? null;
  const shopName =
    membership?.shopName ??
    (order.sellerRole === USER_ROLES.seller ? order.sellerName : null);

  // Fetched unconditionally (not just for pending/failed) — the Payment
  // Information section below needs to correctly label a paid/refunded
  // order's channel too, not only show a failure reason.
  const activePayment = await getActivePaymentForOrder(order.id).catch(() => null);

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

  // Phase 5A: request_return now also accepts a cancelled order that was
  // already paid (see the migration for why — cancelling a paid order used
  // to leave it with no refund path at all). Mirrors request_return's own
  // precondition exactly so this entry point never offers something the
  // server would reject.
  // Same condition `buyer_order_lifecycle` uses for its "to_pay" bucket
  // (payment_method = 'xendit' AND payment_status IN ('pending','failed')) —
  // recomputed here rather than reading `lifecycleTab` because `getBuyerOrder`
  // doesn't populate it (see `Order.lifecycleTab`'s doc comment). Falls back
  // to GCash when no payment row exists yet, same as `OrderCardActions`.
  const showPaymentRecovery =
    order.paymentMethod === "xendit" &&
    (order.paymentStatus === "pending" || order.paymentStatus === "failed");
  const recoveryChannel =
    (activePayment?.paymentChannel as "GCASH" | "PAYMAYA" | "CARD" | null) ?? "GCASH";

  // Reuses the existing checkout-group-membership lookup (already used to
  // build the post-payment redirect) purely to size the grouping indicator
  // below — informational only, no behavior change for any channel.
  const groupSize = order.checkoutGroupId
    ? await getOrderIdsForCheckoutGroup(order.checkoutGroupId)
        .then((ids) => ids.length)
        .catch(() => 1)
    : 1;

  const canRequestReturn =
    order.status === ORDER_STATUS.delivered ||
    (order.status === ORDER_STATUS.cancelled && order.paymentStatus === "paid");

  // Whole-order return only in this UI (the RPC also supports a per-item
  // scope — see request_return — but a single "Request Return" entry point
  // matches the buyer-facing lifecycle this phase actually asked for).
  const returnRequest = canRequestReturn
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

      {showPaymentRecovery ? (
        <div className={cn(RJ_CARD, "flex flex-col gap-3 p-5")}>
          {order.checkoutGroupId && groupSize > 1 ? (
            <p className="text-xs font-semibold text-rj-gray-500">
              {groupSize}-shop order — paid together
            </p>
          ) : null}
          {order.checkoutGroupId ? (
            <PaymentRecoveryPanel
              checkoutGroupId={order.checkoutGroupId}
              channel={recoveryChannel}
              isFailed={order.paymentStatus === "failed"}
            />
          ) : (
            <PaymentRecoveryPanel
              orderId={order.id}
              channel={recoveryChannel}
              isFailed={order.paymentStatus === "failed"}
            />
          )}
        </div>
      ) : null}

      {canRequestReturn ? (
        returnRequest ? (
          <ReturnRequestStatusCard request={returnRequest} evidenceUrl={returnEvidenceUrl} />
        ) : (
          <RequestReturnPanel orderId={order.id} />
        )
      ) : null}

      <SellerShopRow shopName={shopName} shopId={membership?.shopId ?? null} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <OrderItemsList
            items={order.items}
            currency={order.currency}
            orderId={order.id}
            reviewableOrderItemIds={reviewableOrderItemIds}
          />
        </div>
        <div className="flex flex-col gap-6">
          <OrderSummary order={order} />
          <section
            aria-label="Payment information"
            className={cn(RJ_CARD, "p-5")}
          >
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-400">
              Payment Information
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
            <p className="mt-3 border-t border-rj-gray-100 pt-3 text-xs text-rj-gray-600">
              Payment method:{" "}
              <span className="font-semibold text-rj-black">
                {paymentMethodLabel(activePayment)}
              </span>
            </p>
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
