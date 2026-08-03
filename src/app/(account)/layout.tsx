import type { ReactNode } from "react";

import { AccountShell } from "@/features/account/components/AccountShell";
import { requireSessionUser } from "@/lib/supabase/queries";

/**
 * Shared customer-account layout. `proxy.ts` already redirects unauthenticated
 * visitors to sign-in; this is the belt-and-suspenders server re-check.
 */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();
  return <AccountShell user={user}>{children}</AccountShell>;
}
