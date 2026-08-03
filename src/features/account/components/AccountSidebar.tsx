"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Package, UserRound } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { signOutAction } from "@/features/auth/actions/auth.actions";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import type { SessionUser } from "@/types/common.types";

const ACCOUNT_NAV = [
  { href: ROUTES.account, label: "Overview", icon: LayoutGrid },
  { href: ROUTES.orders, label: "Orders", icon: Package },
  { href: ROUTES.profile, label: "Profile", icon: UserRound },
] as const;

/**
 * Account navigation + identity. Vertical column on desktop (sticky), a
 * horizontal scroll row of pill chips on mobile.
 */
export function AccountSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const initials = getInitials(user.fullName ?? user.email);

  return (
    <aside className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rj-black text-[13px] font-bold text-rj-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-rj-black">
            {user.fullName ?? "My account"}
          </p>
          <p className="truncate text-xs text-rj-gray-600">{user.email}</p>
        </div>
      </div>

      <nav
        aria-label="Account"
        className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== ROUTES.account && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 lg:rounded-xl",
                isActive
                  ? "bg-rj-black text-rj-white"
                  : "text-rj-gray-600 hover:bg-rj-gray-100 hover:text-rj-black",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={signOutAction} className="mt-auto">
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-rj-red-dark transition-colors hover:bg-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
