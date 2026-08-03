import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ROUTES, PROTECTED_ROUTE_PREFIXES, ROUTES } from "@/constants/routes";
import { updateSupabaseSession } from "@/lib/supabase/session";

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.signIn;
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.home;
    url.search = "";
    return NextResponse.redirect(url);
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
