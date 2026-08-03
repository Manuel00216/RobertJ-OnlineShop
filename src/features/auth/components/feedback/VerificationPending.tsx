"use client";

import { Mail } from "lucide-react";
import { useEffect, useRef } from "react";

import { AuthButton } from "@/features/auth/components/AuthButton";

export interface VerificationPendingProps {
  /** Email the verification link was sent to. */
  email: string;
  /** Seconds remaining on the resend cooldown (0 = resend enabled). */
  resendCooldown?: number;
  /** Inline failure copy for the resend action (low-severity, non-blocking). */
  resendError?: string | null;
  /** Briefly true after a successful resend ("Sent!" flash). */
  justSent?: boolean;
  /** Resend in flight — disables the button. */
  resendPending?: boolean;
  onResend?: () => void;
  onGoBack?: () => void;
}

/**
 * Register's post-submit "Check Your Email" state (frozen spec §4). Inline
 * substate of `/sign-up`, not a separate route. On mount it moves focus to the
 * heading (WCAG 2.4.3) — spec §10.1.
 */
export function VerificationPending({
  email,
  resendCooldown = 0,
  resendError = null,
  justSent = false,
  resendPending = false,
  onResend,
  onGoBack,
}: VerificationPendingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cooldown = resendCooldown > 0;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const resendLabel = justSent
    ? "Sent!"
    : cooldown
      ? `Resend in ${resendCooldown}s`
      : "Resend email";

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-rj-red/15 text-rj-red"
        style={{ animation: "pop 0.7s ease both" }}
      >
        <Mail className="h-7 w-7" aria-hidden="true" />
      </span>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-2xl leading-tight text-rj-black outline-none"
      >
        Check Your Email
      </h2>

      <p className="text-sm text-rj-gray-600">
        We sent a verification link to <span className="font-semibold text-rj-black">{email}</span>.
        Click it to activate your account.
      </p>

      <AuthButton
        type="button"
        variant="rjOutline"
        size="rjSm"
        className="mt-2 w-auto"
        disabled={cooldown}
        isLoading={resendPending}
        onClick={onResend}
      >
        {resendLabel}
      </AuthButton>

      {resendError ? (
        <p className="text-xs text-rj-red-dark" role="alert">
          {resendError}
        </p>
      ) : null}

      {onGoBack ? (
        <button
          type="button"
          onClick={onGoBack}
          className="text-sm font-semibold text-rj-red-dark hover:underline"
        >
          Wrong email? Go back
        </button>
      ) : null}
    </div>
  );
}
