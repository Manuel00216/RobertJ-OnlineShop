import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutGrid,
  Package,
  RotateCcw,
  Settings,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ADMIN_ONLY_ROLES, DASHBOARD_ROLES, type UserRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
  status: "available" | "comingSoon";
}

/**
 * Role-based only — every item here is gated by `profiles.role`, never by
 * `seller_id` or any shop/ownership concept. Sellers today are 1:1 with
 * `profiles` rows; when `shops`/`shop_users` land, shop owners still
 * authenticate as `role = 'seller'`, so this list and its filter need no
 * changes. Ownership-scoped data access belongs in `queries.ts` + RLS, not here.
 */
export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { href: ROUTES.dashboard, label: "Overview", icon: LayoutGrid, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.dashboardProducts, label: "Products", icon: Package, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.inventory, label: "Inventory", icon: Boxes, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.dashboardOrders, label: "Orders", icon: ClipboardList, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.paymentVerification, label: "Payments", icon: Wallet, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.adminReturns, label: "Returns & Refunds", icon: RotateCcw, roles: ADMIN_ONLY_ROLES, status: "available" },
  { href: ROUTES.reports, label: "Reports", icon: BarChart3, roles: DASHBOARD_ROLES, status: "available" },
  { href: ROUTES.adminUsers, label: "Users", icon: Users, roles: ADMIN_ONLY_ROLES, status: "available" },
  { href: ROUTES.adminShops, label: "Shops", icon: Store, roles: ADMIN_ONLY_ROLES, status: "available" },
  { href: ROUTES.adminAuditLog, label: "Audit Log", icon: History, roles: ADMIN_ONLY_ROLES, status: "available" },
  { href: ROUTES.adminSettings, label: "Settings", icon: Settings, roles: ADMIN_ONLY_ROLES, status: "comingSoon" },
] as const;

export function getVisibleDashboardNav(role: UserRole): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
