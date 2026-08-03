"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActionState } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { signInAction } from "@/features/auth/actions/auth.actions";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { AuthHeader } from "@/features/auth/components/layout/AuthHeader";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";
import type { ActionResult } from "@/types/action.types";

import { EmailInput } from "../fields/EmailInput";
import { PasswordInput } from "../fields/PasswordInput";

/**
 * `/sign-in` form (frozen spec §3), wired to the existing `signInAction`.
 * On success it returns the user to `redirectTo` (set by `proxy.ts`) or home.
 * `redirectTo` is read from `window.location.search` in the effect so the form
 * keeps full SSR (no `useSearchParams`/Suspense) — per the Next.js docs'
 * optimization note.
 */
export function LoginForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(signInAction, null);

  useEffect(() => {
    if (state?.success) {
      const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");
      router.replace(redirectTo ?? ROUTES.home);
    }
  }, [state, router]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <>
      <AuthHeader
        title={AUTH_COPY.signIn.cardTitle}
        switchLink={
          <p className="text-sm text-rj-gray-600">
            {AUTH_COPY.signIn.registerPromptPrefix}{" "}
            <Link
              href={ROUTES.signUp}
              className="font-semibold text-rj-red-dark hover:underline"
            >
              {AUTH_COPY.signIn.registerPromptLink}
            </Link>
          </p>
        }
      />
      <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-5">
        {formError ? <ErrorState title="Unable to sign in" message={formError} /> : null}

        <EmailInput
          name="email"
          required
          placeholder={AUTH_COPY.signIn.emailPlaceholder}
          errors={fieldErrors?.email}
        />

        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
          labelAction={
            <Link
              href={ROUTES.forgotPassword}
              className="text-xs font-semibold text-rj-red-dark hover:underline"
            >
              {AUTH_COPY.signIn.forgotPassword}
            </Link>
          }
          errors={fieldErrors?.password}
        />

        <AuthButton type="submit" isLoading={isPending}>
          {AUTH_COPY.signIn.submitLabel}
        </AuthButton>
      </form>
    </>
  );
}
