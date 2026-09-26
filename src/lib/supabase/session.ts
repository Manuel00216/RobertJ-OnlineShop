import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/config/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase session on every request and returns both the
 * mutated response (carrying updated cookies) and the current user.
 * Consumed by `src/proxy.ts`.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user,
    /**
     * Whether the signed-in account is active. `is_active` isn't carried in the
     * JWT, so this is a single-column self-row read. It lives here — rather than
     * in the `queries.ts` service layer — because middleware can't use the
     * RSC `cookies()`-bound client the service layer relies on; this reuses the
     * request-bound client already created above. Callers gate this to protected
     * routes so public traffic never pays for the round-trip. Fails open only
     * when the row is missing (e.g. mid-signup), mirroring `getSessionUser()`.
     */
    async isAccountActive(): Promise<boolean> {
      if (!user) return true;
      const { data } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      return data?.is_active ?? true;
    },
    /**
     * Ends the session locally (clears the auth cookies; no global network
     * revoke — the app-layer guards already reject a deactivated account
     * server-side) and returns the response carrying the cleared cookies.
     */
    async signOut(): Promise<NextResponse> {
      await supabase.auth.signOut({ scope: "local" });
      return response;
    },
  };
}
