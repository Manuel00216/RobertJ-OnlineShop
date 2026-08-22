import { Suspense } from "react";
import type { Metadata } from "next";

import { ADMIN_ONLY_ROLES, type UserRole } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { UserRoleFilter } from "@/features/users/components/UserRoleFilter";
import { UsersTable } from "@/features/users/components/UsersTable";
import { listAdminUsers, listShops, requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Users — Dashboard" };

async function DashboardUsersData({ role }: { role: UserRole | null }) {
  const [users, shops] = await Promise.all([listAdminUsers(), listShops()]);
  const activeShops = shops.filter((shop) => shop.active);
  const filteredUsers = role ? users.filter((user) => user.role === role) : users;
  return <UsersTable users={filteredUsers} shops={activeShops} />;
}

interface DashboardUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTERABLE_ROLES: readonly string[] = ["buyer", "seller"];

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardUsersPage({
  searchParams,
}: DashboardUsersPageProps) {
  await requireRole(ADMIN_ONLY_ROLES);
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : null;
  // Ignore an unrecognized/tampered value rather than passing it through to
  // the equality filter below (which would just silently match nothing).
  const role = roleParam && FILTERABLE_ROLES.includes(roleParam) ? (roleParam as UserRole) : null;

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Users"
        description="Promote a buyer to Seller and assign them to a shop."
      />
      <UserRoleFilter />
      <Suspense key={role ?? "all"} fallback={<DashboardRowsSkeleton label="Loading users" />}>
        <DashboardUsersData role={role} />
      </Suspense>
    </div>
  );
}
