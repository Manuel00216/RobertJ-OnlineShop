"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { BuyAgainButton } from "@/features/orders/components/BuyAgainButton";
import { CancelOrderButton } from "@/features/orders/components/CancelOrderButton";
import type { LifecycleTab } from "@/features/orders/constants/order-lifecycle.constants";
import type { Order } from "@/features/orders/types/order.types";
// Imported directly from its component file, not the feature barrel — the
// barrel also re-exports `PaymentsList`, which pulls in
// `xendit-reconciliation` and the server-only Xendit client; bundling that
// into this Client Component via the barrel breaks the build ("server-only
// cannot be imported from a Client Component"). `CheckoutForm`/
// `XenditPaymentOptions` already import these the same way for the same
// reason.
import { PaymentRecoveryPanel } from "@/features/payments/components/PaymentRecoveryPanel";
import type { OrderGroupInfo } from "@/features/orders/utils/order-grouping";
import { cn } from "@/lib/utils/cn";

export interface OrderCardActionsProps {
  order: Order;
  lifecycleTab: LifecycleTab;
  /** This order's multi-seller checkout group membership, if any — drives the Card grouped-payment UI below. Omitted/null for an ungrouped order. */
  groupInfo?: OrderGroupInfo | null;
}

/**
 * Buyer-only per-tab action row for the `/orders` list, passed into
 * `OrderCard`'s `actions` slot. Composes existing, already-tested actions —
 * never rebuilds payment, cancellation, or return logic. "Contact Seller" is
 * deliberately absent: no messaging feature exists in this codebase.
 */
export function OrderCardActions({ order, lifecycleTab, groupInfo = null }: OrderCardActionsProps) {
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

    // Card-only: GCash/Maya's retry button already resumes one shared
    // checkout URL across every group member (see
    // `createXenditGroupEwalletPaymentAction`'s existing
    // `attempt.xenditPaymentRequestId && attempt.checkoutUrl` resume
    // branch), so one button per card there is already safe/idempotent —
    // left exactly as-is. Card has no equivalent resume path (its
    // short-lived `components_sdk_key` means a fresh session is minted on
    // every call — confirmed live: Xendit rejects a second session for an
    // already-used customer reference_id with 409 DUPLICATE_ERROR), so
    // showing one independent "Pay with Card" button per shop invites a
    // real collision, not just visual clutter. Collapsing to one shared
    // action for the group's primary card is what avoids that.
    const cardGroupInfo = isGroup && channel === "CARD" ? groupInfo : null;
    const isSecondaryCardMember = cardGroupInfo !== null && !cardGroupInfo.isPrimary;

    return (
      <div className="flex w-full flex-col gap-2">
        {cardGroupInfo ? (
          <p className="text-xs font-semibold text-rj-gray-500">
            {cardGroupInfo.groupSize}-shop order — paid together
          </p>
        ) : null}
        <div className="flex w-full flex-wrap items-end justify-between gap-3">
          {isSecondaryCardMember && cardGroupInfo ? (
            <p className="text-xs text-rj-gray-600">
              Included in the payment for order #{cardGroupInfo.primaryOrderNumber} above.
            </p>
          ) : (
            <PaymentRecoveryPanel
              {...paymentProps}
              channel={channel}
              isFailed={order.paymentStatus === "failed"}
            />
          )}
          {!isGroup ? (
            <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
          ) : null}
        </div>
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
          href={ROUTES.orderCancellation(order.id)}
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
