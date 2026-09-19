"use client";

import { useRef, useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { cancelOrderAction } from "@/features/orders/actions/order.actions";
import {
  CANCELLATION_REASONS,
  OTHER_CANCELLATION_REASON,
} from "@/features/orders/constants/cancellation-reasons.constants";
import { cn } from "@/lib/utils/cn";

/**
 * Cancel trigger + inline confirm for a cancellable order (pending/confirmed).
 * The confirm panel requires picking a reason (or typing one under "Other")
 * before the button enables — persisted as `orders.cancellation_reason` and
 * surfaced later on the order's "View Cancellation Details" page. Calls the
 * non-form `cancelOrderAction` from the event handler inside `startTransition`
 * (the documented pattern for actions without a form); the action revalidates
 * so the timeline and history update in place.
 */
export function CancelOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const resolvedReason =
    selectedReason === OTHER_CANCELLATION_REASON
      ? otherText.trim()
      : (CANCELLATION_REASONS.find((reason) => reason.value === selectedReason)?.label ?? "");

  function handleCancel() {
    if (!resolvedReason) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction(orderId, resolvedReason);
      if (!result.success) setError(result.error);
    });
  }

  function reset() {
    setConfirmOpen(false);
    setSelectedReason(null);
    setOtherText("");
    setError(null);
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
            description="Please select a cancellation reason. Take note that this will cancel the whole order and the action cannot be undone."
            tone="danger"
            confirmLabel="Yes, cancel order"
            pendingLabel="Cancelling…"
            cancelLabel="Not now"
            isPending={isPending}
            triggerRef={triggerRef}
            onConfirm={handleCancel}
            onCancel={reset}
            confirmDisabled={!resolvedReason}
          >
            <fieldset className="mt-3 flex flex-col gap-2">
              <legend className="text-xs font-semibold text-foreground">
                Select a cancellation reason
              </legend>
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={() => setSelectedReason(reason.value)}
                    className="h-4 w-4 shrink-0 accent-rj-red"
                  />
                  {reason.label}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="radio"
                  name="cancel-reason"
                  value={OTHER_CANCELLATION_REASON}
                  checked={selectedReason === OTHER_CANCELLATION_REASON}
                  onChange={() => setSelectedReason(OTHER_CANCELLATION_REASON)}
                  className="h-4 w-4 shrink-0 accent-rj-red"
                />
                Other
              </label>
              {selectedReason === OTHER_CANCELLATION_REASON ? (
                <input
                  type="text"
                  value={otherText}
                  onChange={(event) => setOtherText(event.target.value)}
                  placeholder="Please specify…"
                  maxLength={500}
                  autoFocus
                  className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
                />
              ) : null}
            </fieldset>
          </ConfirmPanel>
          {error ? (
            <ErrorState title="Couldn't cancel the order" message={error} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
