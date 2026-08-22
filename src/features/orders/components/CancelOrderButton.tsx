"use client";

import { useRef, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { cancelOrderAction } from "@/features/orders/actions/order.actions";
import { cn } from "@/lib/utils/cn";

/**
 * Cancel trigger + inline confirm for a cancellable order (pending/confirmed).
 * Calls the non-form `cancelOrderAction` from the event handler inside
 * `startTransition` (the documented pattern for actions without a form); the
 * action revalidates so the timeline and history update in place.
 */
export function CancelOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          ref={triggerRef}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
          onClick={() => setConfirmOpen(true)}
        >
          Cancel order
        </button>
      </div>

      {confirmOpen ? (
        <>
          <ConfirmPanel
            label={`Cancel order ${orderNumber}`}
            title={`Cancel order ${orderNumber}?`}
            description="This can't be undone. Once an order has been packed or shipped, it can no longer be cancelled."
            tone="danger"
            confirmLabel="Yes, cancel order"
            pendingLabel="Cancelling…"
            cancelLabel="Keep order"
            isPending={isPending}
            triggerRef={triggerRef}
            onConfirm={handleCancel}
            onCancel={() => setConfirmOpen(false)}
          />
          {error ? (
            <ErrorState title="Couldn't cancel the order" message={error} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
