import { EmptyState } from "@/components/feedback/EmptyState";
import { UserRow } from "@/features/users/components/UserRow";
import type { AdminUser } from "@/features/users/types/user.types";
import type { Shop } from "@/features/shops/types/shop.types";

export interface UsersTableProps {
  users: AdminUser[];
  /** Active shops for the assign dropdown. */
  shops: Shop[];
}

/** `/dashboard/users`'s list — mirrors `DashboardProductsPanel`'s data-down, no-fetching shape. */
export function UsersTable({ users, shops }: UsersTableProps) {
  if (users.length === 0) {
    return <EmptyState title="No users yet" description="Registered users will appear here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map((user) => (
        <UserRow key={user.id} user={user} shops={shops} />
      ))}
    </div>
  );
}
