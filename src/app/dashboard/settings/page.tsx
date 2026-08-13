import type { Metadata } from "next";

import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { DashboardComingSoon } from "@/features/dashboard/components/DashboardComingSoon";
import { requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Settings — Dashboard" };

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardSettingsPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  return (
    <DashboardComingSoon
      eyebrow="Dashboard"
      title="Settings"
      description="Platform configuration will appear here once this section ships."
    />
  );
}
