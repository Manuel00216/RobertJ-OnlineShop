"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { recordReturnItemConditionAction } from "@/features/returns/actions/return.actions";
import type { ReturnItemCondition } from "@/features/returns/types/return.types";

export interface RecordReturnConditionPanelProps {
  returnId: string;
}

/**
 * The order's own seller (or admin) records whether a refunded return's
 * item is actually sellable — a deliberate second step after the refund
 * decision, not automatic. Mirrors `DecideReturnPanel`'s shape. Only ever
 * rendered by the caller once `request.status === 'refunded'` and neither
 * `restockedAt` nor `markedUnsellableAt` is set yet.
 */
export function RecordReturnConditionPanel({ returnId }: RecordReturnConditionPanelProps) {
  const [pendingCondition, setPendingCondition] = useState<ReturnItemCondition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!pendingCondition) return;
    setError(null);
    startTransition(async () => {
      const result = await recordReturnItemConditionAction(returnId, pendingCondition);
      if (!result.success) {
        setError(result.error);
        setPendingCondition(null);
        return;
      }
      setPendingCondition(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState title="Couldn't record item condition" message={error} /> : null}

      {pendingCondition ? (
        <ConfirmPanel
          label={`Confirm: mark item ${pendingCondition === "sellable" ? "sellable" : "not sellable"}`}
          title={
            pendingCondition === "sellable"
              ? "Confirm the item is sellable?"
              : "Confirm the item is not sellable?"
          }
          description={
            pendingCondition === "sellable"
              ? "This restores the returned quantity to your inventory right away."
              : "Stock will not be restored — use this for damaged or non-resellable items."
          }
          tone="neutral"
          confirmVariant={pendingCondition === "sellable" ? "primary" : "danger"}
          confirmLabel={pendingCondition === "sellable" ? "Yes, restock" : "Yes, don't restock"}
          isPending={isPending}
          onConfirm={confirm}
          onCancel={() => setPendingCondition(null)}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Is the returned item in sellable condition?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="rjSm"
              onClick={() => setPendingCondition("sellable")}
            >
              Sellable — restock
            </Button>
            <Button
              type="button"
              variant="danger"
              size="rjSm"
              onClick={() => setPendingCondition("not_sellable")}
            >
              Not sellable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
