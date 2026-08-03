import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Only allow same-origin, absolute-path redirects to avoid open redirects.
      const target = next.startsWith("/") ? next : ROUTES.home;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${ROUTES.signIn}?error=auth_callback_failed`,
  );
}
