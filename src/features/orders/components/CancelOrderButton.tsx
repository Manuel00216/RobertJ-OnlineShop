"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { cancelOrderAction } from "@/features/orders/actions/order.actions";
import { cn } from "@/lib/utils/cn";

/**
 * Cancel trigger + inline confirm for a cancellable order (pending/confirmed).
 * Calls the non-form `cancelOrderAction` from the event handler inside
 * `startTransition` (the documented pattern for actions without a form); the
 * action revalidates so the timeline and history update in place. The confirm
 * is focus-managed: focus moves into the panel on open and returns to the
 * trigger on close/Escape.
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

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
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="false"
          aria-label={`Cancel order ${orderNumber}`}
          tabIndex={-1}
          className="rounded-2xl border border-danger/40 bg-danger/5 p-5 outline-none"
        >
          <p className="text-sm font-bold text-rj-black">
            Cancel order {orderNumber}?
          </p>
          <p className="mt-1 text-xs text-rj-gray-600">
            This can&apos;t be undone. Once an order has been packed or shipped,
            it can no longer be cancelled.
          </p>

          {error ? (
            <div className="mt-3">
              <ErrorState title="Couldn't cancel the order" message={error} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isPending}
              onClick={handleCancel}
            >
              {isPending ? "Cancelling…" : "Yes, cancel order"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false);
                triggerRef.current?.focus();
              }}
            >
              Keep order
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
