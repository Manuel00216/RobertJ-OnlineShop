import type { ReactNode } from "react";

import { DashboardSidebar } from "@/features/dashboard/components/DashboardSidebar";
import type { SessionUser } from "@/types/common.types";

/**
 * Shared seller/admin dashboard chrome — a responsive sidebar + main grid,
 * parallel to (not shared with) `AccountShell`, since that module is
 * deliberately "never an admin surface." Role-based only: this shell filters
 * navigation by `user.role`, never by `seller_id` or any shop/ownership
 * concept, so it needs no changes when `shops`/`shop_users` land — that data
 * scoping belongs entirely in `queries.ts` + RLS.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-rj-white text-rj-black">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <DashboardSidebar user={user} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
