"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { createXenditEwalletPaymentAction } from "@/features/payments/actions/xendit.actions";
import { XenditCardPaymentButton } from "@/features/payments/components/XenditCardPaymentButton";

/**
 * Buyer-facing "Pay Online" entry point for a pending order — GCash/Maya
 * redirect straight to Xendit's hosted checkout; Card uses an embedded
 * Xendit Components widget. None of these mark the order paid themselves —
 * only the Xendit webhook does that (see `process_xendit_webhook`).
 */
export function XenditPaymentOptions({
  orderId,
  existingCheckoutUrl,
}: {
  orderId: string;
  /** A still-valid, previously-started attempt's checkout URL, if any — resuming avoids creating a duplicate. */
  existingCheckoutUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function payWithEwallet(channelCode: "GCASH" | "PAYMAYA") {
    setError(null);
    startTransition(async () => {
      const result = await createXenditEwalletPaymentAction(orderId, channelCode);
      if (!result.success) setError(result.error);
    });
  }

  if (existingCheckoutUrl) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-rj-gray-600">You have a payment in progress.</p>
        <a
          href={existingCheckoutUrl}
          className="inline-flex w-fit items-center rounded-full bg-rj-red px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rj-red-dark"
        >
          Continue to payment
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="rj"
          size="rj"
          isLoading={isPending}
          onClick={() => payWithEwallet("GCASH")}
        >
          Pay with GCash
        </Button>
        <Button
          type="button"
          variant="rj"
          size="rj"
          isLoading={isPending}
          onClick={() => payWithEwallet("PAYMAYA")}
        >
          Pay with Maya
        </Button>
      </div>
      <XenditCardPaymentButton orderId={orderId} />
      {error ? <ErrorState title="Couldn't start payment" message={error} /> : null}
    </div>
  );
}
