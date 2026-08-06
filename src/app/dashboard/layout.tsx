import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DASHBOARD_ROLES } from "@/constants/roles";
import { requireRole } from "@/lib/supabase/queries";

/**
 * Minimal dashboard chrome — the first real page under /dashboard. Not a full
 * sidebar shell (Inventory/Reports/etc. don't exist yet); just enough to host
 * the payment verification queue. `proxy.ts` only gates `/dashboard` by
 * session presence, not role — this `requireRole` call is the actual
 * authorization check (belt-and-suspenders alongside RLS and the RPCs' own
 * checks). `bg-rj-white` is explicit (mirroring `(shop)/layout.tsx`) because
 * the root layout's `bg-background` token flips to near-black under
 * `prefers-color-scheme: dark` without it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(DASHBOARD_ROLES);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-rj-white font-sans text-rj-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
