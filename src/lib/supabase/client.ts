import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/config/env";
import type { Database } from "@/lib/supabase/database.types";

/** Supabase client for Client Components. Never use in Server Components. */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
