"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import {
  linkProviderSchema,
  unlinkProviderSchema,
  updateProfileSchema,
} from "@/features/account/schemas/account.schema";
import type { Profile } from "@/features/account/types/account.types";

/** Updates the signed-in user's own profile row. RLS restricts the write to own row. */
export async function updateProfileAction(
  _prevState: ActionResult<Profile> | null,
  formData: FormData,
): Promise<ActionResult<Profile>> {
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`updateProfile:${user.id}`, 5, 60);
    const profile = await queries.updateMyProfile(user.id, parsed.data);
    // Re-render the profile page and the shared header/identity surfaces.
    revalidatePath(ROUTES.profile, "layout");
    revalidatePath("/", "layout");
    return ok(profile);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update your profile.",
    );
  }
}

/**
 * Manually links a Google/Facebook identity to the signed-in user (Connected
 * Accounts panel, `/profile`). This is the sanctioned fallback for the case
 * automatic linking can't safely handle — e.g. Facebook without a
 * provider-verified email — and is safe specifically because the caller is
 * already an authenticated, proven owner of this account. Bound directly to
 * `<form action={...}>` (plain `void | Promise<void>` DOM form action, not
 * `useActionState`) — success is a full navigation to the provider's consent
 * screen. Failures redirect back to `/profile?error=<code>` rather than
 * returning an `ActionResult`, which a plain form action never reads; the
 * profile page maps that code via `mapOAuthCallbackError`, same as sign-in.
 */
export async function linkIdentityAction(formData: FormData): Promise<void> {
  const parsed = linkProviderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${ROUTES.profile}?error=oauth_start_failed`);
  }

  let url: string;
  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`link:${user.id}`, 10, 300);
    url = await queries.linkOAuthIdentity(parsed.data.provider, ROUTES.profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = /too many attempts/i.test(message) ? "rate_limited" : "oauth_start_failed";
    redirect(`${ROUTES.profile}?error=${code}`);
  }

  redirect(url);
}

/** Disconnects a linked identity. Refuses to remove the caller's last remaining identity. */
export async function unlinkIdentityAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = unlinkProviderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`unlink:${user.id}`, 10, 300);
    const identities = await queries.listUserIdentities();
    const identity = identities.find((i) => i.identity_id === parsed.data.identityId);
    if (!identity) {
      return fail("That connected account could not be found.");
    }
    if (identities.length < 2) {
      return fail("You need at least one other way to sign in before disconnecting this one.");
    }
    await queries.unlinkOAuthIdentity(identity);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not disconnect that account.",
    );
  }

  revalidatePath(ROUTES.profile, "layout");
  return ok(null);
}
