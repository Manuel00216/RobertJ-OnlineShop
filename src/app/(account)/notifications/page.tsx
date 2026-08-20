import type { Metadata } from "next";

import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ActivityFeed } from "@/features/notifications/components/ActivityFeed";
import { getBuyerActivityFeed, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  // `proxy.ts` already guards /notifications; this is the belt-and-suspenders re-check.
  await requireSessionUser();
  const events = await getBuyerActivityFeed().catch(() => []);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Activity"
        title="Notifications"
        description="Updates on your orders and payments."
      />
      <ActivityFeed events={events} />
    </div>
  );
}
