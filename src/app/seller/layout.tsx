import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { SellerLayout, type SellerNotification } from "@/features/seller";
import {
  getLowStockReport,
  getOrderAttentionCounts,
  requireRole,
} from "@/lib/supabase/queries";

/**
 * Real pending-work signals surfaced as notifications — no mock data, no
 * separate notifications table. The "Pending orders" count uses
 * `getOrderAttentionCounts().needsConfirmation` — the same definition as
 * `SellerKpiRow`'s KPI tile, `SellerQuickAccess`'s badge, and the Action
 * Center card — so this bell never disagrees with the rest of the dashboard.
 */
async function getSellerNotifications(): Promise<SellerNotification[]> {
  const [attentionCounts, lowStock] = await Promise.all([
    getOrderAttentionCounts(),
    getLowStockReport(),
  ]);

  const notifications: SellerNotification[] = [];

  if (attentionCounts.needsConfirmation > 0) {
    notifications.push({
      id: "pending-orders",
      title: "Pending orders",
      description: `${attentionCounts.needsConfirmation} order${attentionCounts.needsConfirmation === 1 ? "" : "s"} awaiting confirmation`,
      href: ROUTES.sellerOrders,
      tone: "warning",
    });
  }
  if (lowStock.length > 0) {
    notifications.push({
      id: "low-stock",
      title: "Low stock",
      description: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} running low or out of stock`,
      href: ROUTES.sellerInventory,
      tone: "danger",
    });
  }
  return notifications;
}

export default async function SellerRootLayout({ children }: { children: ReactNode }) {
  const user = await requireRole([USER_ROLES.seller]);
  const notifications = await getSellerNotifications();

  return (
    <SellerLayout user={user} notifications={notifications}>
      {children}
    </SellerLayout>
  );
}
