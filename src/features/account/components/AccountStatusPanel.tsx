"use client";

import { useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { deactivateAccountAction } from "@/features/account/actions/account.actions";
import { cn } from "@/lib/utils/cn";

/**
 * `/privacy`'s Account Status section. `isActive` comes from the caller's
 * own `requireSessionUser()` — real data, not a hardcoded "Active". In
 * practice this always renders "Active": `requireSessionUser()` itself
 * throws for a deactivated session, so an inactive account can never reach
 * this page to see otherwise — that's the correct, real invariant, not a
 * fake display value. Deactivating signs the buyer out and redirects on
 * success (`deactivateAccountAction` mirrors `signOutAction`'s shape); it
 * never hard-deletes anything, matching every FK on this account's order/
 * payment history (see the audit) and letting an administrator reactivate
 * the same way any other deactivated account is reactivated.
 */
export function AccountStatusPanel({ isActive }: { isActive: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleConfirm() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deactivateAccountAction();
      if (!result.success) {
        setError(result.error);
        setConfirming(false);
      }
      // On success the action itself redirects to sign-in; nothing to do here.
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-rj-black">Account status</span>
        <Badge tone={isActive ? "success" : "danger"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {confirming ? (
        <ConfirmPanel
          label="Deactivate account"
          title="Deactivate your account?"
          description="You'll be signed out immediately. Your order and payment history is kept — contact an administrator to reactivate."
          tone="danger"
          confirmLabel="Deactivate"
          pendingLabel="Deactivating…"
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
          triggerRef={triggerRef}
        />
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={cn(buttonVariants({ variant: "danger", size: "rjSm" }), "self-start")}
          onClick={() => setConfirming(true)}
        >
          Deactivate Account
        </button>
      )}

      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
