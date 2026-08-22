"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { unlinkIdentityAction } from "@/features/account/actions/account.actions";
import type { ActionResult } from "@/types/action.types";

/**
 * One identity's "Disconnect" control. Its own `useActionState` instance —
 * each row in `ConnectedAccounts` renders its own copy of this component so
 * pending/error state stays scoped to the row the user actually clicked.
 */
export function UnlinkIdentityButton({
  identityId,
  disabled,
  disabledReason,
}: {
  identityId: string;
  /** True when this is the account's last remaining identity — Supabase requires ≥2 to unlink. */
  disabled: boolean;
  disabledReason: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult<null> | null, FormData>(
    unlinkIdentityAction,
    null,
  );
  const error = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="identityId" value={identityId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        isLoading={isPending}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
      >
        Disconnect
      </Button>
      {error ? <p className="text-xs text-rj-red-dark">{error}</p> : null}
    </form>
  );
}
