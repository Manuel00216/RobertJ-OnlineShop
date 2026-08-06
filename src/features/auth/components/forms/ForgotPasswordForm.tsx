"use client";

import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useActionState } from "react";
import { useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { requestPasswordResetAction } from "@/features/auth/actions/auth.actions";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { AuthSuccessState } from "@/features/auth/components/feedback/AuthSuccessState";
import { AuthHeader } from "@/features/auth/components/layout/AuthHeader";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";
import type { ActionResult } from "@/types/action.types";

import { EmailInput } from "../fields/EmailInput";

/**
 * `/forgot-password` form (frozen spec §5), wired to
 * `requestPasswordResetAction`, which always reports success (no enumeration).
 * On success the card swaps in place to the "Check Your Inbox" state.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(requestPasswordResetAction, null);

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
        icon={MailCheck}
        tone="success"
        headline="Check Your Inbox"
        body="If an account exists for that email, we've sent a link to reset your password. The link expires in 1 hour."
        action={
          <Link
            href={ROUTES.signIn}
            className="text-sm font-semibold text-rj-red-dark hover:underline"
          >
            {AUTH_COPY.forgotPassword.backToSignIn}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Link
        href={ROUTES.signIn}
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-rj-red-dark hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {AUTH_COPY.forgotPassword.backToSignIn}
      </Link>

      <AuthHeader
        title={AUTH_COPY.forgotPassword.cardTitle}
        description={AUTH_COPY.forgotPassword.cardDescription}
      />

      <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-5">
        {formError ? <ErrorState title="Could not send reset link" message={formError} /> : null}

        <EmailInput
          name="email"
          required
          placeholder={AUTH_COPY.forgotPassword.emailPlaceholder}
          errors={fieldErrors?.email}
        />

        <AuthButton type="submit" isLoading={isPending}>
          {AUTH_COPY.forgotPassword.submitLabel}
        </AuthButton>
      </form>
    </>
  );
}
