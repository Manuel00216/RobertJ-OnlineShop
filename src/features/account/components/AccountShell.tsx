import type { ReactNode } from "react";

import { AccountSidebar } from "@/features/account/components/AccountSidebar";
import type { SessionUser } from "@/types/common.types";

/**
 * Shared customer-account chrome: a responsive sidebar + main grid on `rj-*`
 * surfaces (a seamless extension of the Landing design system — never an admin
 * surface). The sidebar collapses to a horizontal nav on mobile.
 */
export function AccountShell({
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
          <AccountSidebar user={user} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
