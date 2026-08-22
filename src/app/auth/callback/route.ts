import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
