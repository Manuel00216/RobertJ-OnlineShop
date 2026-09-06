import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { RETURN_STATUS } from "@/constants/status";
import { AdminLayout, type AdminNotification } from "@/features/admin";
import {
  getDashboardOrderSummary,
  getLowStockReport,
  listReturnRequests,
  requireRole,
} from "@/lib/supabase/queries";

/** Real pending-work signals surfaced as notifications — no mock data, no separate notifications table. */
async function getAdminNotifications(): Promise<AdminNotification[]> {
  const [orderSummary, lowStock, pendingReturns] = await Promise.all([
    getDashboardOrderSummary(),
    getLowStockReport(),
    listReturnRequests(RETURN_STATUS.sellerAccepted),
  ]);

  const notifications: AdminNotification[] = [];

  if (orderSummary.statusCounts.pending > 0) {
    notifications.push({
      id: "pending-orders",
      title: "Pending orders",
      description: `${orderSummary.statusCounts.pending} order${orderSummary.statusCounts.pending === 1 ? "" : "s"} awaiting confirmation`,
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
