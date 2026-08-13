import type { Metadata } from "next";

import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { UsersTable } from "@/features/users/components/UsersTable";
import { listAdminUsers, listShops, requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Users — Dashboard" };

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardUsersPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  const [users, shops] = await Promise.all([listAdminUsers(), listShops()]);
  const activeShops = shops.filter((shop) => shop.active);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Users"
        description="Promote a buyer to Seller and assign them to a shop."
      />
      <UsersTable users={users} shops={activeShops} />
    </div>
  );
}
