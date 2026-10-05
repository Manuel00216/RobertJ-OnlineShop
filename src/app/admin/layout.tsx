import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { RETURN_STATUS } from "@/constants/status";
import { AdminLayout, type AdminNotification } from "@/features/admin";
import {
  getLowStockReport,
  getOrderAttentionCounts,
  listReturnRequests,
  requireRole,
} from "@/lib/supabase/queries";

/**
 * Real pending-work signals surfaced as notifications — no mock data, no
 * separate notifications table. The "Pending orders" count uses
 * `getOrderAttentionCounts().needsConfirmation` — the same definition as
 * `AdminKpiRow`'s KPI tile and `AdminQuickAccess`'s badge — so this bell
 * never disagrees with the rest of the dashboard.
 */
async function getAdminNotifications(): Promise<AdminNotification[]> {
  const [attentionCounts, lowStock, pendingReturns] = await Promise.all([
    getOrderAttentionCounts(),
    getLowStockReport(),
    listReturnRequests(RETURN_STATUS.sellerAccepted),
  ]);

  const notifications: AdminNotification[] = [];

  if (attentionCounts.needsConfirmation > 0) {
    notifications.push({
      id: "pending-orders",
      title: "Pending orders",
      description: `${attentionCounts.needsConfirmation} order${attentionCounts.needsConfirmation === 1 ? "" : "s"} awaiting confirmation`,
      href: ROUTES.adminOrders,
      tone: "warning",
    });
  }
  if (lowStock.length > 0) {
    notifications.push({
      id: "low-stock",
      title: "Low stock",
      description: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} running low or out of stock`,
      href: ROUTES.adminInventory,
      tone: "danger",
    });
  }
  if (pendingReturns.length > 0) {
    notifications.push({
      id: "pending-returns",
      title: "Returns awaiting decision",
      description: `${pendingReturns.length} return request${pendingReturns.length === 1 ? "" : "s"} need your review`,
      href: ROUTES.adminReturns,
      tone: "warning",
    });
  }

  return notifications;
}

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(ADMIN_ONLY_ROLES);
  const notifications = await getAdminNotifications();

  return (
    <AdminLayout user={user} notifications={notifications}>
      {children}
    </AdminLayout>
  );
}
