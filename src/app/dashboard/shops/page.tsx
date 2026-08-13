import type { Metadata } from "next";

import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { DashboardComingSoon } from "@/features/dashboard/components/DashboardComingSoon";
import { requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Shops — Dashboard" };

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardShopsPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  return (
    <DashboardComingSoon
      eyebrow="Dashboard"
      title="Shops"
      description="Shop management will appear here once the shops model ships."
    />
  );
}
