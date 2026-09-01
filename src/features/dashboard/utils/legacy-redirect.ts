import { redirect } from "next/navigation";

import { USER_ROLES } from "@/constants/roles";
import { requireSessionUser } from "@/lib/supabase/queries";

/**
 * Every page under `src/app/dashboard/**` is now a legacy redirect into
 * either the Admin or Seller Portal — `dashboard/layout.tsx` already
 * guarantees the caller is `seller` or `admin` (`requireRole(DASHBOARD_ROLES)`
 * ran first), so "not admin" safely means "seller" here.
 */
export async function redirectToPortal(adminRoute: string, sellerRoute: string): Promise<never> {
  const user = await requireSessionUser();
  redirect(user.role === USER_ROLES.admin ? adminRoute : sellerRoute);
}
