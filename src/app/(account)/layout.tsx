import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AccountShell } from "@/features/account/components/AccountShell";
import { requireSessionUser } from "@/lib/supabase/queries";

/**
 * Shared customer-account layout. `proxy.ts` already redirects unauthenticated
 * visitors to sign-in; this is the belt-and-suspenders server re-check.
 * Uses the same site-wide SiteHeader/SiteFooter as every other route group —
 * account pages previously had no header/footer chrome at all.
 */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();
  return (
    <>
      <SiteHeader />
      <AccountShell user={user}>{children}</AccountShell>
      <SiteFooter />
    </>
  );
}
