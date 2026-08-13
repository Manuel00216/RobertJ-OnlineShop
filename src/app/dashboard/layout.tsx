import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DASHBOARD_ROLES } from "@/constants/roles";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { requireRole } from "@/lib/supabase/queries";

/**
 * Seller/admin dashboard chrome — role-aware sidebar via `DashboardShell`.
 * `proxy.ts` only gates `/dashboard` by session presence, not role — this
 * `requireRole` call is the actual authorization check (belt-and-suspenders
 * alongside RLS and the RPCs' own checks). `bg-rj-white` is explicit
 * (mirroring `(shop)/layout.tsx`) because the root layout's `bg-background`
 * token flips to near-black under `prefers-color-scheme: dark` without it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole(DASHBOARD_ROLES);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-rj-white font-sans text-rj-black">
      <SiteHeader />
      <DashboardShell user={user}>{children}</DashboardShell>
      <SiteFooter />
    </div>
  );
}
