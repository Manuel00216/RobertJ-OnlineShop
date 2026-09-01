import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { SellerLayout, type SellerNotification } from "@/features/seller";
import {
  getDashboardOrderSummary,
  getLowStockReport,
  listPendingPayments,
  requireRole,
} from "@/lib/supabase/queries";

/** Real pending-work signals surfaced as notifications — no mock data, no separate notifications table. */
async function getSellerNotifications(): Promise<SellerNotification[]> {
  const [orderSummary, lowStock, pendingPayments] = await Promise.all([
    getDashboardOrderSummary(),
    getLowStockReport(),
    listPendingPayments(),
  ]);

  const notifications: SellerNotification[] = [];

  if (orderSummary.statusCounts.pending > 0) {
    notifications.push({
      id: "pending-orders",
      title: "Pending orders",
      description: `${orderSummary.statusCounts.pending} order${orderSummary.statusCounts.pending === 1 ? "" : "s"} awaiting confirmation`,
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
  if (pendingPayments.length > 0) {
    notifications.push({
      id: "pending-payments",
      title: "Pending payments",
      description: `${pendingPayments.length} payment${pendingPayments.length === 1 ? "" : "s"} awaiting verification`,
      href: ROUTES.sellerPayments,
      tone: "info",
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
