"use client";

import { PaymentFailedRetry } from "@/features/payments/components/PaymentFailedRetry";
import { XenditCardPaymentButton } from "@/features/payments/components/XenditCardPaymentButton";

const CHANNEL_LABELS: Record<"GCASH" | "PAYMAYA", string> = {
  GCASH: "GCash",
  PAYMAYA: "Maya",
};

type PaymentRecoveryPanelProps = (
  | { orderId: string; checkoutGroupId?: undefined }
  | { orderId?: undefined; checkoutGroupId: string }
) & {
  channel: "GCASH" | "PAYMAYA" | "CARD";
  isFailed: boolean;
};

/**
 * Channel-aware Pay Now / Retry block for a "To Pay" order — a Card session
 * widget for CARD, the existing GCash/Maya retry button otherwise. Used only
 * by Checkout's payment workspace (`CheckoutResumePanel`) and the checkout
 * page's own inline Card-completion step (`CheckoutForm`) — never by Orders,
 * which may only link into Checkout, not render payment actions itself (see
 * docs/payment-ux-architecture-audit.md).
 */
export function PaymentRecoveryPanel({ channel, isFailed, ...paymentProps }: PaymentRecoveryPanelProps) {
  if (channel === "CARD") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-rj-gray-600">
          Complete your Card Payment to finish this order.
        </p>
        <XenditCardPaymentButton {...paymentProps} />
      </div>
    );
  }

  return (
    <PaymentFailedRetry
      {...paymentProps}
      channel={channel}
      channelLabel={CHANNEL_LABELS[channel]}
      status={isFailed ? "failed" : "pending"}
    />
  );
}
