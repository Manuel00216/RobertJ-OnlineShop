"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import { getClientIp } from "@/lib/utils/request";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { mapAuthError } from "@/features/auth/constants/auth-errors";
import {
  forgotPasswordSchema,
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
    );
  } catch (error) {
    return fail(mapAuthError(error));
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
    );
  } catch (error) {
    return fail(mapAuthError(error));
  }

  revalidatePath("/", "layout");
  return ok(null);
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
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Keyed by email, not IP — this action must stay enumeration-safe
    // (always returns ok() below), so the limiter can't leak existence
    // either. Caps email-bombing a single inbox.
    await queries.requireRateLimit(`passwordreset:${parsed.data.email}`, 5, 300);
    await queries.sendPasswordResetEmail(parsed.data.email);
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
