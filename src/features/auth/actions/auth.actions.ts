"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import { getClientIp } from "@/lib/utils/request";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { mapAuthError } from "@/features/auth/constants/auth-errors";
import { isInternalPath } from "@/lib/utils/url";
import {
  forgotPasswordSchema,
  oauthSignInSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas/auth.schema";

export async function signInAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Keyed by email (not just IP) so a distributed credential-stuffing
    // attack against one account from many IPs is still throttled.
    await queries.requireRateLimit(`signin:${parsed.data.email}`, 10, 300);
    await queries.signInWithPassword(
      parsed.data.email,
      parsed.data.password,
      parsed.data.captchaToken,
    );
  } catch (error) {
    return fail(mapAuthError(error));
  }

  // Password auth succeeded — a deactivated account's session is still
  // cryptographically valid at this point (it's a real Supabase Auth
  // session), so check is_active explicitly and undo the sign-in rather
  // than let the user land on a page that then fails confusingly on their
  // first click via requireSessionUser().
  const user = await queries.getSessionUser();
  if (user && !user.isActive) {
    await queries.signOut();
    return fail("Your account has been deactivated. Contact support for assistance.");
  }

  revalidatePath("/", "layout");
  return ok(null);
}

export async function signUpAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`signup:${ip}`, 5, 300);
    await queries.signUpWithPassword(
      parsed.data.email,
      parsed.data.password,
      parsed.data.fullName,
      parsed.data.captchaToken,
    );
  } catch (error) {
    return fail(mapAuthError(error));
  }

  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * Starts Google/Facebook sign-in. Bound directly to `<form action={...}>`
 * (a plain `void | Promise<void>` DOM form action, not `useActionState`) —
 * success is a full navigation to the provider's consent screen, so there's
 * no client state to react to, same as `signOutAction` below. Every path
 * ends in `redirect()`, including failure: rather than returning an
 * `ActionResult` no plain form action would ever read, failures redirect
 * back to `/sign-in?error=<code>`, reusing the same `mapOAuthCallbackError`
 * copy the `/auth/callback` route's own failures already render there.
 */
export async function signInWithOAuthAction(formData: FormData): Promise<void> {
  const parsed = oauthSignInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${ROUTES.signIn}?error=oauth_start_failed`);
  }

  const next = isInternalPath(parsed.data.redirectTo) ? parsed.data.redirectTo : undefined;

  let url: string;
  try {
    const ip = await getClientIp();
    // Keyed by IP, not email — we don't know the account yet at this point.
    // This only throttles generation of the redirect URL itself; the
    // provider and Supabase separately rate-limit the actual OAuth exchange.
    await queries.requireRateLimit(`oauth:${parsed.data.provider}:${ip}`, 15, 300);
    url = await queries.signInWithOAuth(parsed.data.provider, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = /too many attempts/i.test(message) ? "rate_limited" : "oauth_start_failed";
    redirect(`${ROUTES.signIn}?error=${code}`);
  }

  // redirect() throws NEXT_REDIRECT — must stay outside the try/catch above,
  // or it gets caught and misreported as a failed sign-in.
  redirect(url);
}

export async function signOutAction() {
  await queries.signOut();
  revalidatePath("/", "layout");
  redirect(ROUTES.signIn);
}

/**
 * Prepared for the Forgot Password screen. Always reports success to avoid
 * leaking which emails are registered; real errors are logged server-side.
 */
export async function requestPasswordResetAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = requestPasswordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Keyed by email, not IP — this action must stay enumeration-safe
    // (always returns ok() below), so the limiter can't leak existence
    // either. Caps email-bombing a single inbox.
    await queries.requireRateLimit(`passwordreset:${parsed.data.email}`, 5, 300);
    await queries.sendPasswordResetEmail(parsed.data.email, parsed.data.captchaToken);
  } catch (error) {
    console.error("Password reset request failed:", error);
  }
  return ok(null);
}

/** Prepared for the Reset Password screen (used inside a recovery session). */
export async function updatePasswordAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Belt-and-suspenders: the reset-password page already gates on this,
    // but the action must not trust that it was only ever reached that way.
    await queries.requireRecoverySession();
    const user = await queries.requireSessionUser();
    // Same rate-limit pattern as every other auth-mutating action (see
    // signInAction/signUpAction/requestPasswordResetAction above) — this one
    // was the sole gap, keyed by user id since the recovery session is
    // already authenticated at this point.
    await queries.requireRateLimit(`passwordupdate:${user.id}`, 5, 300);
    await queries.updatePassword(parsed.data.password);
  } catch (error) {
    return fail(mapAuthError(error));
  }

  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * Re-sends the sign-up confirmation email (Email Verification substate, spec
 * §4). Uses the email-only schema; errors are normalised like every other
 * action so the raw Supabase message never reaches the UI.
 */
export async function resendVerificationAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireRateLimit(`resendverify:${parsed.data.email}`, 5, 300);
    await queries.resendVerificationEmail(parsed.data.email);
  } catch (error) {
    return fail(mapAuthError(error));
  }

  return ok(null);
}
