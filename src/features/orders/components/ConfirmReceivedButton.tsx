"use client";

import { useRef, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { confirmOrderReceivedAction } from "@/features/orders/actions/order.actions";
import { cn } from "@/lib/utils/cn";

export interface ConfirmReceivedButtonProps {
  orderId: string;
  orderNumber: string;
}

/**
 * The buyer's "everything arrived as expected" completion action — the
 * counterpart to `ReportProblemPanel`'s "something's wrong" path. Same
 * inline-confirm shape as `MarkCodCollectedButton`: a one-shot, hard-to-undo
 * action gets a confirm step, not an instant click.
 */
export function ConfirmReceivedButton({ orderId, orderNumber }: ConfirmReceivedButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmOrderReceivedAction(orderId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        ref={triggerRef}
        className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        onClick={() => setConfirmOpen(true)}
      >
        Confirm Received
      </button>

      {confirmOpen ? (
        <>
          <ConfirmPanel
            label={`Confirm receipt of order ${orderNumber}`}
            title="Confirm you received this order?"
            description="Only confirm once everything has arrived and is as expected — this closes out the order."
            tone="neutral"
            confirmLabel="Yes, I received it"
            pendingLabel="Confirming…"
            cancelLabel="Not yet"
            isPending={isPending}
            triggerRef={triggerRef}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmOpen(false)}
          />
          {error ? <ErrorState title="Couldn't confirm receipt" message={error} /> : null}
        </>
      ) : null}
    </div>
  );
}
