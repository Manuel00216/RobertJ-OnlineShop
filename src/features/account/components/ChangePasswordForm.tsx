"use client";

import { useActionState } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/features/auth";
import { changePasswordAction } from "@/features/account/actions/account.actions";
import type { ActionResult } from "@/types/action.types";

/**
 * `/change-password` form — requires the current password (re-verified
 * server-side, see `changePasswordAction`) before accepting a new one.
 * Separate from `ResetPasswordForm`/`updatePasswordAction`: that flow only
 * works inside a password-recovery session, not a normal signed-in one.
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(changePasswordAction, null);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="flex max-w-xl flex-col gap-5"
    >
      {formError ? (
        <ErrorState title="Couldn't update your password" message={formError} />
      ) : null}
      {state?.success ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-rj-green/30 bg-rj-green/5 p-4 text-sm font-medium text-rj-green"
        >
          Your password has been changed.
        </div>
      ) : null}

      <PasswordInput
        label="Current password"
        name="currentPassword"
        required
        autoComplete="current-password"
        errors={fieldErrors?.currentPassword}
      />
      <PasswordInput
        label="New password"
        name="password"
        required
        autoComplete="new-password"
        hint={`Must be at least 10 characters`}
        errors={fieldErrors?.password}
      />
      <PasswordInput
        label="Confirm new password"
        name="confirmPassword"
        required
        autoComplete="new-password"
        errors={fieldErrors?.confirmPassword}
      />

      <Button
        type="submit"
        variant="rj"
        size="rj"
        isLoading={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
