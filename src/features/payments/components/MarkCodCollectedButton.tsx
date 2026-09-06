"use client";

import { useRef, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { markCodPaymentCollectedAction } from "@/features/payments/actions/payment.actions";
import { cn } from "@/lib/utils/cn";

/**
 * Seller/admin marks a COD order's cash as collected. COD never auto-marks
 * paid at order creation — this is the only path (see
 * `mark_cod_payment_collected`), and it's blocked server-side if the order
 * has an active/paid online payment attempt instead.
 */
export function MarkCodCollectedButton({ orderId }: { orderId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await markCodPaymentCollectedAction(orderId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          ref={triggerRef}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
          onClick={() => setConfirmOpen(true)}
        >
          Mark COD payment as collected
        </button>
      </div>

      {confirmOpen ? (
        <>
          <ConfirmPanel
            label="Mark COD payment as collected"
            title="Mark this COD payment as collected?"
            description="Confirm only once you've actually received the cash for this order."
            tone="neutral"
            confirmLabel="Yes, mark as collected"
            pendingLabel="Saving…"
            cancelLabel="Not yet"
            isPending={isPending}
            triggerRef={triggerRef}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmOpen(false)}
          />
          {error ? (
            <ErrorState title="Couldn't mark this payment as collected" message={error} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
