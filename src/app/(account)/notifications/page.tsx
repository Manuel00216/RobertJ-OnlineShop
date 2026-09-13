import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ActivityFeed } from "@/features/notifications/components/ActivityFeed";
import {
  getBuyerActivityFeed,
  getMyBuyerPreferences,
  requireSessionUser,
} from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  // `proxy.ts` already guards /notifications; this is the belt-and-suspenders re-check.
  const user = await requireSessionUser();
  const preferences = await getMyBuyerPreferences(user.id).catch(() => null);

  const orderUpdatesOff = preferences !== null && !preferences.orderUpdates;

  const events = orderUpdatesOff ? [] : await getBuyerActivityFeed().catch(() => []);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title="Notifications"
        description="Updates on your orders and payments."
      />
      {orderUpdatesOff ? (
        <EmptyState
          title="Order updates are turned off"
          description="Turn Order Updates back on in Privacy & Settings to see this feed again."
          action={
            <Link
              href={ROUTES.privacy}
              className="text-sm font-semibold text-rj-red-dark hover:underline"
            >
              Go to Privacy &amp; Settings
            </Link>
          }
        />
      ) : (
        <ActivityFeed events={events} />
      )}
    </div>
  );
}
