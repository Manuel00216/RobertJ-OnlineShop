"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useActionState } from "react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { Turnstile } from "@/components/Turnstile";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/constants/routes";
import {
  resendVerificationAction,
  signUpAction,
} from "@/features/auth/actions/auth.actions";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { VerificationPending } from "@/features/auth/components/feedback/VerificationPending";
import { AuthFooter } from "@/features/auth/components/layout/AuthFooter";
import { AuthHeader } from "@/features/auth/components/layout/AuthHeader";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";
import type { ActionResult } from "@/types/action.types";

import { AUTH_INPUT_CLASS } from "../fields/field-classes";
import { EmailInput } from "../fields/EmailInput";
import { PasswordInput } from "../fields/PasswordInput";
import { Divider } from "../social/Divider";
import { SocialLoginButtons } from "../social/SocialLoginButtons";

/**
 * `/sign-up` form (frozen spec §4), wired to the existing `signUpAction`.
 * On success the whole card content swaps in place to `VerificationPending`
 * (the Email Verification experience) — the confirm-password match is the one
 * client-only check, per the spec.
 */
export function RegisterForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(signUpAction, null);

  const [view, setView] = useState<"form" | "pending">("form");
  const [email, setEmail] = useState("");
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const handled = useRef(false);

  // Swap to the verification-pending state the first time the action succeeds.
  useEffect(() => {
    if (state?.success && !handled.current) {
      handled.current = true;
      setView("pending");
      setResendCooldown(30);
    }
  }, [state]);

  // Turnstile tokens are single-use — remount the widget for a fresh one
  // after every submit attempt (success or failure).
  useEffect(() => {
    if (!state) return;
    // Turnstile tokens are single-use — this must reset after every submit
    // attempt (success or failure), not just on external-system sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
  }, [state]);

  // Resend cooldown countdown (spec §4: disable for 30s after sending).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // Client-only confirm-password check; everything else validates server-side.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirmPassword") ?? "");
    if (password !== confirm) {
      e.preventDefault();
      setConfirmError("Passwords do not match.");
      return;
    }
    setConfirmError(undefined);
  };

  const handleResend = async () => {
    const fd = new FormData();
    fd.set("email", email);
    setResendError(null);
    const result = await resendVerificationAction(null, fd);
    if (result.success) {
      setResendCooldown(30);
      setJustSent(true);
      window.setTimeout(() => setJustSent(false), 1500);
    } else {
      setResendError(result.error);
    }
  };

  const handleGoBack = () => {
    handled.current = false;
    setView("form");
    setResendCooldown(0);
    setResendError(null);
  };

  if (view === "pending") {
    return (
      <VerificationPending
        email={email}
        resendCooldown={resendCooldown}
        resendError={resendError}
        justSent={justSent}
        onResend={handleResend}
        onGoBack={handleGoBack}
      />
    );
  }

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <>
      <AuthHeader
        title={AUTH_COPY.signUp.cardTitle}
        switchLink={
          <p className="text-base text-rj-gray-600">
            {AUTH_COPY.signUp.signInPromptPrefix}{" "}
            <Link
              href={ROUTES.signIn}
              className="font-semibold text-rj-red-dark hover:underline"
            >
              {AUTH_COPY.signUp.signInPromptLink}
            </Link>
          </p>
        }
      />
      <SocialLoginButtons />
      <Divider />
      <form
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        {formError ? <ErrorState title="Could not create account" message={formError} /> : null}

        <FormField
          label="Full Name"
          name="fullName"
          autoComplete="name"
          required
          tone="brand"
          icon={<User className="h-4 w-4" aria-hidden="true" />}
          placeholder={AUTH_COPY.signUp.fullNamePlaceholder}
          className={cn(AUTH_INPUT_CLASS, "pl-11")}
          errors={fieldErrors?.fullName}
        />

        <EmailInput
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={AUTH_COPY.signIn.emailPlaceholder}
          errors={fieldErrors?.email}
        />

        <PasswordInput
          name="password"
          required
          autoComplete="new-password"
          hint={AUTH_COPY.signUp.passwordHint}
          errors={fieldErrors?.password}
        />

        <PasswordInput
          label={AUTH_COPY.signUp.confirmPasswordLabel}
          name="confirmPassword"
          required
          autoComplete="new-password"
          errors={confirmError ? [confirmError] : fieldErrors?.confirmPassword}
        />

        <Turnstile key={captchaKey} onVerify={setCaptchaToken} />
        <input type="hidden" name="captchaToken" value={captchaToken} />

        <AuthButton type="submit" isLoading={isPending} disabled={!captchaToken}>
          {AUTH_COPY.signUp.submitLabel}
        </AuthButton>

        <AuthFooter className="text-[11px] leading-relaxed text-rj-gray-600">
          {AUTH_COPY.signUp.termsPrefix}{" "}
          <Link
            href="#"
            className="text-rj-black underline underline-offset-2 hover:text-rj-red-dark"
          >
            {AUTH_COPY.signUp.termsLink}
          </Link>{" "}
          and{" "}
          <Link
            href="#"
            className="text-rj-black underline underline-offset-2 hover:text-rj-red-dark"
          >
            {AUTH_COPY.signUp.privacyLink}
          </Link>
          .
        </AuthFooter>
      </form>
    </>
  );
}
