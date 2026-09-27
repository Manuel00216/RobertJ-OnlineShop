import { EmptyState } from "@/components/feedback/EmptyState";
import { UserRow } from "@/features/users/components/UserRow";
import type { AdminUser } from "@/features/users/types/user.types";
import type { Shop } from "@/features/shops/types/shop.types";

export interface UsersTableProps {
  users: AdminUser[];
  /** Active shops for the assign dropdown. */
  shops: Shop[];
  /** True when a search/role filter is active — swaps the empty-state copy. */
  filtering?: boolean;
  /** Buyer ids with an in-flight order — M2's non-blocking promote warning. */
  activeOrderBuyerIds?: Set<string>;
}

/** `/dashboard/users`'s list — mirrors `DashboardProductsPanel`'s data-down, no-fetching shape. */
export function UsersTable({
  users,
  shops,
  filtering = false,
  activeOrderBuyerIds,
}: UsersTableProps) {
  if (users.length === 0) {
    return filtering ? (
      <EmptyState title="No matching users" description="Try a different search term or filter." />
    ) : (
      <EmptyState title="No users yet" description="Registered users will appear here." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          shops={shops}
          hasActiveOrders={activeOrderBuyerIds?.has(user.id) ?? false}
        />
      ))}
    </div>
  );
}
