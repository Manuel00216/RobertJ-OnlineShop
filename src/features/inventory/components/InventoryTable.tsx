import { EmptyState } from "@/components/feedback/EmptyState";
import { InventoryRow } from "@/features/inventory/components/InventoryRow";
import type { InventoryItem } from "@/features/inventory/types/inventory.types";

export interface InventoryTableProps {
  items: InventoryItem[];
  isAdmin: boolean;
}

/**
 * `/dashboard/inventory`'s list. Data is fetched once, server-side, by the
 * page (mirrors `DashboardProductsPanel`) — this component does no fetching
 * of its own; RLS already scoped `items` to the caller's own shop(s), or
 * every shop for an admin.
 */
export function InventoryTable({ items, isAdmin }: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No stock to manage yet"
        description="Inventory rows are created automatically for every product."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <InventoryRow key={item.id} item={item} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
