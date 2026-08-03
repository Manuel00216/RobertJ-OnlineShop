"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useActionState } from "react";
import { useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { updatePasswordAction } from "@/features/auth/actions/auth.actions";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { AuthSuccessState } from "@/features/auth/components/feedback/AuthSuccessState";
import { AuthHeader } from "@/features/auth/components/layout/AuthHeader";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";
import type { ActionResult } from "@/types/action.types";

import { PasswordInput } from "../fields/PasswordInput";

/**
 * `/reset-password` form (frozen spec §6), wired to `updatePasswordAction`,
 * shown only inside an active recovery session (the page guards §6.B). On
 * success the card swaps to "Password Updated" with an explicit Continue
 * button — no timed redirect (WCAG 2.2.1).
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(updatePasswordAction, null);

  const [success, setSuccess] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (state?.success && !handled.current) {
      handled.current = true;
      setSuccess(true);
    }
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  if (success) {
    return (
      <AuthSuccessState
        icon={Check}
        tone="success"
        headline="Password Updated"
        body="Your password has been changed. You're all set."
        action={
          <AuthButton type="button" onClick={() => router.push(ROUTES.home)}>
            Continue to RobertJ
          </AuthButton>
        }
      />
    );
  }

  return (
    <>
      <AuthHeader
        title={AUTH_COPY.resetPassword.cardTitle}
        description={AUTH_COPY.resetPassword.cardDescription}
      />

      <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-5">
        {formError ? <ErrorState title="Could not update password" message={formError} /> : null}

        <PasswordInput
          name="password"
          required
          autoComplete="new-password"
          hint={AUTH_COPY.resetPassword.passwordHint}
          errors={fieldErrors?.password}
        />

        <PasswordInput
          label={AUTH_COPY.resetPassword.confirmPasswordLabel}
          name="confirmPassword"
          required
          autoComplete="new-password"
          errors={fieldErrors?.confirmPassword}
        />

        <AuthButton type="submit" isLoading={isPending}>
          {AUTH_COPY.resetPassword.submitLabel}
        </AuthButton>
      </form>
    </>
  );
}
