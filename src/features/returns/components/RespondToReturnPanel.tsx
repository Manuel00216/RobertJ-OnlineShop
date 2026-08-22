"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { respondToReturnAction } from "@/features/returns/actions/return.actions";
import type { SellerReturnDecision } from "@/features/returns/types/return.types";

export interface RespondToReturnPanelProps {
  returnId: string;
}

/**
 * The order's own seller (or admin) accepts/rejects a pending return
 * request — mirrors `VerificationCard`'s two-button-then-shared-`ConfirmPanel`
 * shape. Only ever rendered by the caller when `request.status === 'pending'`.
 */
export function RespondToReturnPanel({ returnId }: RespondToReturnPanelProps) {
  const [pendingDecision, setPendingDecision] = useState<SellerReturnDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDecision() {
    if (!pendingDecision) return;
    setError(null);
    startTransition(async () => {
      const result = await respondToReturnAction(returnId, pendingDecision);
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
      {error ? <ErrorState title="Couldn't respond to this return" message={error} /> : null}

      {pendingDecision ? (
        <ConfirmPanel
          label={`Confirm: ${pendingDecision} this return request`}
          title={
            pendingDecision === "accept"
              ? "Accept this return request?"
              : "Reject this return request?"
          }
          description={
            pendingDecision === "accept"
              ? "An administrator will review and process the refund next."
              : "The buyer can still escalate — an administrator may overrule this."
          }
          tone="neutral"
          confirmVariant={pendingDecision === "accept" ? "rj" : "danger"}
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
            onClick={() => setPendingDecision("accept")}
          >
            Accept return
          </Button>
          <Button
            type="button"
            variant="danger"
            size="rjSm"
            onClick={() => setPendingDecision("reject")}
          >
            Reject return
          </Button>
        </div>
      )}
    </div>
  );
}
