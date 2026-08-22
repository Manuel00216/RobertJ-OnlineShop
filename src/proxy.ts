import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ROUTES, PROTECTED_ROUTE_PREFIXES, ROUTES } from "@/constants/routes";
import { updateSupabaseSession } from "@/lib/supabase/session";
import { isInternalPath } from "@/lib/utils/url";

/**
 * `NextResponse.redirect()` builds a brand-new response, so it does not
 * inherit the refreshed session cookies `updateSupabaseSession` attached to
 * `source`. Every redirect branch below must copy them across, or a rotated
 * refresh token gets silently dropped and the session breaks on next use.
 */
function withSessionCookies(redirect: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  // Exact-segment matching: "/account" must not match "/accounting".
  const isProtected = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.signIn;
    // Preserve the original path + query so post-login lands where the user left off.
    url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isAuthRoute && user) {
    // An already-authenticated visitor may land here via a stale
    // ?redirectTo= link — send them onward instead of discarding it.
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const target = new URL(
      isInternalPath(redirectTo) ? redirectTo : ROUTES.home,
      request.nextUrl.origin,
    );
    return withSessionCookies(NextResponse.redirect(target), response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except static assets and image files, so session
     * cookies stay fresh without paying the cost on asset requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
