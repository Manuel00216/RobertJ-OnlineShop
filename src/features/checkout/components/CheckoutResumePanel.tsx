"use client";

import Link from "next/link";
import { useState } from "react";

import { RJ_CARD } from "@/components/ui/card";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import type { XenditChannel } from "@/features/checkout/schemas/checkout.schema";
// Imported directly from its component file, not the payments feature
// barrel — the barrel also re-exports `PaymentsList`, which pulls in
// `xendit-reconciliation` and the server-only Xendit client; bundling that
// into this Client Component via the barrel breaks the build ("server-only
// cannot be imported from a Client Component"). `CheckoutForm` already
// imports payments components the same way for the same reason.
import { PaymentRecoveryPanel } from "@/features/payments/components/PaymentRecoveryPanel";
import { cn } from "@/lib/utils/cn";

const CHANNEL_OPTIONS: Array<{ value: XenditChannel; label: string }> = [
  { value: "GCASH", label: "GCash" },
  { value: "PAYMAYA", label: "Maya" },
  { value: "CARD", label: "Card" },
];

export interface CheckoutResumePanelProps {
  orderId: string;
  checkoutGroupId: string | null;
  groupSize: number;
  orderNumber: string;
  paymentStatus: "pending" | "failed";
  initialChannel: XenditChannel;
  /** Set by the resume page — only true once the current channel is definitively resolved (failed) or nothing has ever reached Xendit yet. See docs/payment-ux-architecture-audit.md §6-7 for why this must never be offered while a payment might still resolve on its own. */
  canChangeChannel: boolean;
  failureReason: string | null;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  currency: string;
  ordersUrl: string;
}

/**
 * Checkout's payment workspace for an order that already exists — retry the
 * same channel, resume an in-flight one, or (once the current attempt is
 * definitively resolved) switch to a different channel. This is the ONLY
 * place buyer payment initiation happens; Orders may only link here, never
 * render payment actions itself (see docs/payment-ux-architecture-audit.md).
 * Reuses `PaymentRecoveryPanel` exactly as Orders used to — only the choice
 * of which channel to pass it is new.
 */
export function CheckoutResumePanel({
  orderId,
  checkoutGroupId,
  groupSize,
  orderNumber,
  paymentStatus,
  initialChannel,
  canChangeChannel,
  failureReason,
  subtotalCents,
  shippingFeeCents,
  totalCents,
  currency,
  ordersUrl,
}: CheckoutResumePanelProps) {
  const [channel, setChannel] = useState<XenditChannel>(initialChannel);
  const [showPicker, setShowPicker] = useState(false);

  const paymentProps = checkoutGroupId ? { checkoutGroupId } : { orderId };
  // Only frame this as a "failure" for the channel that actually failed —
  // switching to a channel that was never attempted is a fresh try, not a retry.
  const isFailed = paymentStatus === "failed" && channel === initialChannel;

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(RJ_CARD, "flex flex-col gap-4 p-6")}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
            Order #{orderNumber}
          </p>
          <h2 className="mt-1 font-serif text-xl text-rj-black">
            {paymentStatus === "failed" ? "Payment didn't go through" : "Complete your payment"}
          </h2>
          {checkoutGroupId && groupSize > 1 ? (
            <p className="mt-1 text-xs font-semibold text-rj-gray-500">
              {groupSize}-shop order — paid together
            </p>
          ) : null}
          {paymentStatus === "failed" && failureReason && channel === initialChannel ? (
            <p className="mt-2 text-xs text-rj-gray-600">
              <span className="font-semibold text-rj-black">Reason: </span>
              {failureReason}
            </p>
          ) : null}
        </div>

        <PaymentRecoveryPanel {...paymentProps} channel={channel} isFailed={isFailed} />

        {canChangeChannel ? (
          showPicker ? (
            <fieldset className="flex flex-col divide-y divide-rj-gray-100 rounded-xl border border-rj-gray-100">
              <legend className="sr-only">Choose a different payment method</legend>
              {CHANNEL_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-rj-red/30",
                    channel === option.value ? "bg-rj-gray-50" : "hover:bg-rj-gray-50",
                  )}
                >
                  <span className="text-sm font-medium text-rj-black">{option.label}</span>
                  <input
                    type="radio"
                    name="resume-payment-channel"
                    value={option.value}
                    checked={channel === option.value}
                    onChange={() => setChannel(option.value)}
                    className="h-4 w-4 shrink-0 accent-rj-red"
                  />
                </label>
              ))}
            </fieldset>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-fit text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
            >
              Use a different payment method
            </button>
          )
        ) : null}
      </div>

      <CheckoutTotals
        subtotalCents={subtotalCents}
        shippingFeeCents={shippingFeeCents}
        totalCents={totalCents}
        currency={currency}
        align="right"
      />

      <Link
        href={ordersUrl}
        className="w-fit text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
      >
        Back to My Orders
      </Link>
    </div>
  );
}
