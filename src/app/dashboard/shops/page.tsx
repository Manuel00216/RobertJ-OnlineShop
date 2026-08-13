import type { Metadata } from "next";

import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { AdminShopsPanel } from "@/features/shops/components/AdminShopsPanel";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { listShopsWithMembers, requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Shops — Dashboard" };

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardShopsPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  const shops = await listShopsWithMembers();

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Shops"
        description="Create and manage shops. Assign a seller to a shop from the Users screen."
      />
      <AdminShopsPanel shops={shops} />
    </div>
  );
}
