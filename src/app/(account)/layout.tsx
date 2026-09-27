import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/constants/roles";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AccountShell } from "@/features/account/components/AccountShell";
import { canPurchase } from "@/lib/auth/permissions";
import { requireSessionUser } from "@/lib/supabase/queries";

/**
 * Shared customer-account layout. `proxy.ts` already redirects unauthenticated
 * visitors to sign-in; this is the belt-and-suspenders server re-check.
 * Uses the same site-wide SiteHeader/SiteFooter as every other route group —
 * account pages previously had no header/footer chrome at all.
 *
 * Strict role separation: the entire Buyer Account section (Account, Orders,
 * Addresses, Notifications, Profile, …) is buyer-only. Seller/admin manage
 * orders in their own portal (`/seller`, `/admin`) and are redirected to the
 * public storefront here — they keep NO buyer account access. This is the
 * single chokepoint for every route in the group; historical buyer data on a
 * role-changed account is untouched (blocked from view, never deleted).
 */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();
  if (!canPurchase(user.role as UserRole)) redirect(ROUTES.home);
  return (
    <>
      <SiteHeader />
      <AccountShell user={user}>{children}</AccountShell>
      <SiteFooter />
    </>
  );
}
