"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import type { OrderStatus } from "@/constants/status";
import { advanceOrderStatusAction } from "@/features/orders/actions/order.actions";
import { ORDER_STATUS_TRANSITIONS } from "@/features/orders/constants/order.constants";
import { cn } from "@/lib/utils/cn";

/** Action-verb phrasing for the forward-advancement button (a noun-phrase status label reads awkwardly as a call-to-action). */
const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  processing: "Mark ready for pickup",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
};

export interface OrderStatusControlProps {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}

/**
 * Seller/admin fulfilment control for the dashboard order detail page —
 * mirrors `CancelOrderButton`'s confirm/transition/focus-management shape,
 * but driven by `ORDER_STATUS_TRANSITIONS` instead of a single hardcoded
 * target. Offers the next forward step (if any) and, separately,
 * cancellation (if still legal) — both go through the same
 * `advanceOrderStatusAction`, so there's one write path, not two.
 */
export function OrderStatusControl({
  orderId,
  orderNumber,
  status,
}: OrderStatusControlProps) {
  const allowed = ORDER_STATUS_TRANSITIONS[status];
  const nextStatus = allowed.find((candidate) => candidate !== "cancelled") ?? null;
  const canCancel = allowed.includes("cancelled");

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingCancel) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmingCancel(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmingCancel]);

  function advance(target: OrderStatus) {
    setError(null);
    startTransition(async () => {
      const result = await advanceOrderStatusAction(orderId, target);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (target === "cancelled") setConfirmingCancel(false);
    });
  }

  if (!nextStatus && !canCancel) return null;

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <ErrorState title="Couldn't update the order" message={error} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {nextStatus ? (
          <Button
            type="button"
            variant="rj"
            size="rjSm"
            isLoading={isPending}
            onClick={() => advance(nextStatus)}
          >
            {ADVANCE_LABELS[nextStatus] ?? `Mark as ${nextStatus}`}
          </Button>
        ) : null}

        {canCancel && !confirmingCancel ? (
          <button
            type="button"
            ref={triggerRef}
            className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel order
          </button>
        ) : null}
      </div>

      {confirmingCancel ? (
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
            This can&apos;t be undone. Stock is restocked automatically.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="rjSm"
              isLoading={isPending}
              onClick={() => advance("cancelled")}
            >
              {isPending ? "Cancelling…" : "Yes, cancel order"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="rjSm"
              disabled={isPending}
              onClick={() => {
                setConfirmingCancel(false);
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
