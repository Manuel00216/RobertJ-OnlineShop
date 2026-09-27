import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/ErrorState";
import { USER_ROLES, type UserRole } from "@/constants/roles";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { isFilterableUserRole } from "@/features/users/constants/user.constants";
import { UserRoleFilter } from "@/features/users/components/UserRoleFilter";
import { UserSearchInput } from "@/features/users/components/UserSearchInput";
import { UsersTable } from "@/features/users/components/UsersTable";
import { userListParamsSchema } from "@/features/users/schemas/user.schema";
import { listAdminUsers, listBuyerIdsWithActiveOrders, listShops } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Users — Admin Portal" };

interface AdminUsersDataProps {
  role: UserRole | null;
  search?: string;
  page: number;
  pageSize: number;
}

/**
 * `admin_list_users()` has no server-side search/limit/offset params (see
 * that RPC's migration — it exists solely to join `auth.users.email`, not to
 * scale to a paginated query shape), so search + pagination are applied here,
 * in the same in-memory step that already did the `role` filter.
 */
async function AdminUsersData({ role, search, page, pageSize }: AdminUsersDataProps) {
  const [users, shops] = await Promise.all([listAdminUsers(), listShops()]);
  const activeShops = shops.filter((shop) => shop.active);

  let filteredUsers = role ? users.filter((user) => user.role === role) : users;
  if (search) {
    const needle = search.toLowerCase();
    filteredUsers = filteredUsers.filter((user) =>
      [user.fullName, user.username, user.email].some((value) =>
        value?.toLowerCase().includes(needle),
      ),
    );
  }

  const filtering = Boolean(role || search);
  const total = filteredUsers.length;

  if (total === 0) {
    return <UsersTable users={[]} shops={activeShops} filtering={filtering} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageUsers = filteredUsers.slice(start, start + pageSize);

  if (pageUsers.length === 0) {
    return <UsersTable users={[]} shops={activeShops} filtering={filtering} />;
  }

  // M2: only the buyers actually rendered need the active-orders check —
  // it's advisory (shown before promoting), never a blocker.
  const buyerIdsOnPage = pageUsers
    .filter((user) => user.role === USER_ROLES.buyer)
    .map((user) => user.id);
  const activeOrderBuyerIds = await listBuyerIdsWithActiveOrders(buyerIdsOnPage);

  return (
    <div className="flex flex-col gap-4">
      <UsersTable
        users={pageUsers}
        shops={activeShops}
        filtering={filtering}
        activeOrderBuyerIds={activeOrderBuyerIds}
      />
      {totalPages > 1 ? <PaginationControls page={page} totalPages={totalPages} themed /> : null}
    </div>
  );
}

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : null;
  const role: UserRole | null = isFilterableUserRole(roleParam) ? roleParam : null;

  const parsed = userListParamsSchema.safeParse(params);
  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-6 p-5 lg:p-7">
        <ErrorState message="Those filters aren't valid. Try clearing your search." />
      </div>
    );
  }
  const { search, page, pageSize } = parsed.data;

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <UserSearchInput />
        </Suspense>
        <Suspense fallback={null}>
          <UserRoleFilter />
        </Suspense>
      </div>

      <Suspense
        key={JSON.stringify(params)}
        fallback={<DashboardRowsSkeleton label="Loading users" />}
      >
        <AdminUsersData role={role} search={search} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
