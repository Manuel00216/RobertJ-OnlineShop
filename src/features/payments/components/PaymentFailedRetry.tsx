"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  createXenditEwalletPaymentAction,
  createXenditGroupEwalletPaymentAction,
} from "@/features/payments/actions/xendit.actions";

type PaymentFailedRetryProps = (
  | { orderId: string; checkoutGroupId?: undefined }
  | { orderId?: undefined; checkoutGroupId: string }
) & {
  channel: "GCASH" | "PAYMAYA";
  channelLabel: string;
  /**
   * `pending`: the order's own automatic handoff into Xendit hasn't
   * completed yet (rare — usually only a brief window right after
   * checkout). `failed`: a genuine Xendit-side failure. Only changes the
   * status line above the button — the action (retry the same channel) and
   * button label are identical either way.
   */
  status: "pending" | "failed";
};

/**
 * Recovery UI for a GCash/Maya payment on a "To Pay" order — one "Pay Now"
 * button for the exact channel the buyer already chose, never a
 * re-presented GCash/Maya/Card picker. Reuses the same actions the original
 * checkout attempt used, so a retry is exactly as idempotency-safe as the
 * first attempt (`beginXenditPaymentAttempt`'s own reconciliation,
 * unchanged). A successful retry redirects straight to Xendit, same as the
 * first attempt.
 */
export function PaymentFailedRetry(props: PaymentFailedRetryProps) {
  const { channel, channelLabel, status } = props;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pay() {
    setError(null);
    startTransition(async () => {
      const result =
        props.orderId !== undefined
          ? await createXenditEwalletPaymentAction(props.orderId, channel)
          : await createXenditGroupEwalletPaymentAction(props.checkoutGroupId, channel);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-rj-black">
          {status === "failed" ? "Payment Failed" : "Payment Pending"}
        </p>
        <p className="mt-1 text-xs text-rj-gray-600">
          {status === "failed"
            ? `Your ${channelLabel} payment didn't go through.`
            : `Complete your ${channelLabel} payment to finish this order.`}
        </p>
      </div>
      <Button
        type="button"
        variant="rj"
        size="rj"
        isLoading={isPending}
        onClick={pay}
        className="w-fit"
      >
        Pay Now
      </Button>
      {error ? <ErrorState title="Couldn't start payment" message={error} /> : null}
    </div>
  );
}
