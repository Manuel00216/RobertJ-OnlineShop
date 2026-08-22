"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { decideReturnAction } from "@/features/returns/actions/return.actions";
import type { AdminReturnDecision } from "@/features/returns/types/return.types";

export interface DecideReturnPanelProps {
  returnId: string;
  /** Whether the seller already rejected this — informs the confirm copy, not the decision itself. */
  sellerRejected: boolean;
}

/**
 * Admin-only: approves (executes the refund) or rejects a return request
 * already responded to by its seller. Mirrors `RespondToReturnPanel`'s
 * shape — only ever rendered by the caller when the request is
 * `seller_accepted`/`seller_rejected`.
 */
export function DecideReturnPanel({ returnId, sellerRejected }: DecideReturnPanelProps) {
  const [pendingDecision, setPendingDecision] = useState<AdminReturnDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDecision() {
    if (!pendingDecision) return;
    setError(null);
    startTransition(async () => {
      const result = await decideReturnAction(returnId, pendingDecision);
      if (!result.success) {
        setError(result.error);
        setPendingDecision(null);
        return;
      }
      setPendingDecision(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState title="Couldn't decide this return" message={error} /> : null}

      {pendingDecision ? (
        <ConfirmPanel
          label={`Confirm: ${pendingDecision} this return request`}
          title={
            pendingDecision === "approve"
              ? "Approve and refund this request?"
              : "Reject this return request?"
          }
          description={
            pendingDecision === "approve"
              ? "This immediately marks the payment refunded — it can't be undone or repeated."
              : "The buyer will not be refunded. This is final."
          }
          tone="danger"
          confirmVariant={pendingDecision === "approve" ? "rj" : "danger"}
          confirmLabel={`Yes, ${pendingDecision}`}
          isPending={isPending}
          onConfirm={confirmDecision}
          onCancel={() => setPendingDecision(null)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="rj"
            size="rjSm"
            onClick={() => setPendingDecision("approve")}
          >
            {sellerRejected ? "Overrule & approve refund" : "Approve refund"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="rjSm"
            onClick={() => setPendingDecision("reject")}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
