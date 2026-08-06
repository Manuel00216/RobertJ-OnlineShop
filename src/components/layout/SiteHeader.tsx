import { SiteHeaderClient } from "@/components/layout/SiteHeaderClient";
import { getSessionUser, listActiveCategories } from "@/lib/supabase/queries";

/**
 * The single site-wide header — mounted by every route group's layout
 * (marketing, shop, account) so navigation, search, and cart/account access
 * are identical everywhere. Server Component: reads the session and category
 * list directly so no route group needs to fetch/pass them itself.
 */
export async function SiteHeader() {
  const [user, categories] = await Promise.all([
    getSessionUser(),
    listActiveCategories().catch(() => []),
  ]);

  return <SiteHeaderClient user={user} categories={categories} />;
}
