import { Suspense } from "react";
import type { Metadata } from "next";

import type { UserRole } from "@/constants/roles";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { UserRoleFilter } from "@/features/users/components/UserRoleFilter";
import { UsersTable } from "@/features/users/components/UsersTable";
import { listAdminUsers, listShops } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Users — Admin Portal" };

async function AdminUsersData({ role }: { role: UserRole | null }) {
  const [users, shops] = await Promise.all([listAdminUsers(), listShops()]);
  const activeShops = shops.filter((shop) => shop.active);
  const filteredUsers = role ? users.filter((user) => user.role === role) : users;
  return <UsersTable users={filteredUsers} shops={activeShops} />;
}

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTERABLE_ROLES: readonly string[] = ["buyer", "seller"];

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : null;
  const role = roleParam && FILTERABLE_ROLES.includes(roleParam) ? (roleParam as UserRole) : null;

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <UserRoleFilter />
      <Suspense key={role ?? "all"} fallback={<DashboardRowsSkeleton label="Loading users" />}>
        <AdminUsersData role={role} />
      </Suspense>
    </div>
  );
}
