"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { BuyAgainButton } from "@/features/orders/components/BuyAgainButton";
import { CancelOrderButton } from "@/features/orders/components/CancelOrderButton";
import type { LifecycleTab } from "@/features/orders/constants/order-lifecycle.constants";
import type { Order } from "@/features/orders/types/order.types";
// Imported directly from their component files, not the feature barrel —
// the barrel also re-exports `PaymentsList`, which pulls in
// `xendit-reconciliation` and the server-only Xendit client; bundling that
// into this Client Component via the barrel breaks the build ("server-only
// cannot be imported from a Client Component"). `CheckoutForm`/
// `XenditPaymentOptions` already import these the same way for the same
// reason.
import { PaymentFailedRetry } from "@/features/payments/components/PaymentFailedRetry";
import { XenditCardPaymentButton } from "@/features/payments/components/XenditCardPaymentButton";
import { cn } from "@/lib/utils/cn";

const CHANNEL_LABELS: Record<"GCASH" | "PAYMAYA", string> = {
  GCASH: "GCash",
  PAYMAYA: "Maya",
};

export interface OrderCardActionsProps {
  order: Order;
  lifecycleTab: LifecycleTab;
}

/**
 * Buyer-only per-tab action row for the `/orders` list, passed into
 * `OrderCard`'s `actions` slot. Composes existing, already-tested actions —
 * never rebuilds payment, cancellation, or return logic. "Contact Seller" is
 * deliberately absent: no messaging feature exists in this codebase.
 */
export function OrderCardActions({ order, lifecycleTab }: OrderCardActionsProps) {
  if (lifecycleTab === "to_pay") {
    // `active_payment_channel` is only ever null here if the eager
    // reservation in `placeOrderAction` genuinely failed (best-effort, see
    // its comment) — GCash is a safe, non-crashing fallback; the buyer's
    // own next payment attempt corrects the underlying row regardless.
    const channel: "GCASH" | "PAYMAYA" | "CARD" = order.activePaymentChannel ?? "GCASH";
    const isGroup = order.checkoutGroupId !== null;
    const paymentProps = order.checkoutGroupId
      ? { checkoutGroupId: order.checkoutGroupId }
      : { orderId: order.id };

    return (
      <div className="flex w-full flex-wrap items-end justify-between gap-3">
        {channel === "CARD" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-rj-gray-600">
              Complete your Card Payment to finish this order.
            </p>
            <XenditCardPaymentButton {...paymentProps} />
          </div>
        ) : (
          <PaymentFailedRetry
            {...paymentProps}
            channel={channel}
            channelLabel={CHANNEL_LABELS[channel]}
            status={order.paymentStatus === "failed" ? "failed" : "pending"}
          />
        )}
        {!isGroup ? (
          <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
        ) : null}
      </div>
    );
  }

  if (lifecycleTab === "completed") {
    return (
      <>
        <BuyAgainButton order={order} />
        <Link
          href={ROUTES.orderDetail(order.id)}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          Request Return
        </Link>
      </>
    );
  }

  if (lifecycleTab === "cancelled") {
    return (
      <>
        <BuyAgainButton order={order} />
        <Link
          href={`${ROUTES.orderDetail(order.id)}/cancellation`}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          View Cancellation Details
        </Link>
      </>
    );
  }

  if (lifecycleTab === "return_refund") {
    return (
      <Link
        href={ROUTES.orderDetail(order.id)}
        className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
      >
        View Details
      </Link>
    );
  }

  return null;
}
