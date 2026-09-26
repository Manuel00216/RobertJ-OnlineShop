import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSessionUser,
  hasRecoverySession,
  signOut,
} from "@/lib/supabase/queries";
import { isInternalPath } from "@/lib/utils/url";

/**
 * PKCE exchange endpoint for Supabase auth email links (sign-up confirmation and
 * password recovery) and OAuth. Trades the `?code` for a session, sets the
 * session cookies, then forwards to `next` (or the home page).
 *
 * This route exists now so the Login / Registration / Forgot Password /
 * Email Verification screens built in the auth phase have a working callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? ROUTES.home;

  // OAuth providers (or GoTrue itself, e.g. when Facebook can't supply an
  // email) can redirect back here with an error and no `code` at all — most
  // commonly the user cancelling the provider's consent screen. Surface a
  // distinguishable code instead of falling through to the generic message.
  const providerError = searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}${ROUTES.signIn}?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Block deactivated accounts here — the same posture `signInAction` takes
      // for the password path (a freshly exchanged OAuth session is still a
      // valid Supabase session at this point). Recovery sessions are exempt so
      // a deactivated account can still complete a password reset via the
      // reset-password screen; only the normal sign-in landing is blocked.
      if (!(await hasRecoverySession())) {
        const user = await getSessionUser();
        if (user && !user.isActive) {
          await signOut();
          return NextResponse.redirect(
            `${origin}${ROUTES.signIn}?error=deactivated`,
          );
        }
      }

      // Only allow same-origin, absolute-path redirects to avoid open redirects
      // (rejects protocol-relative targets like `//evil.com` too).
      const target = isInternalPath(next) ? next : ROUTES.home;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${ROUTES.signIn}?error=auth_callback_failed`,
  );
}
