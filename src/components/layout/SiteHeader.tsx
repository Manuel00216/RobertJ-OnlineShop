import { SiteHeaderClient } from "@/components/layout/SiteHeaderClient";
import {
  getBuyerActivityFeed,
  getMyBuyerPreferences,
  getSessionUser,
  listActiveCategories,
} from "@/lib/supabase/queries";
import type { BuyerActivityEvent } from "@/features/notifications/types/notification.types";

/** Guests, and buyers who turned Order Updates off, see no notifications — mirrors the `/notifications` page's own gate. */
async function loadNotifications(userId: string | undefined): Promise<BuyerActivityEvent[]> {
  if (!userId) return [];
  const preferences = await getMyBuyerPreferences(userId).catch(() => null);
  if (preferences !== null && !preferences.orderUpdates) return [];
  return getBuyerActivityFeed().catch(() => []);
}

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
  const notifications = await loadNotifications(user?.id);

  return <SiteHeaderClient user={user} categories={categories} notifications={notifications} />;
}
