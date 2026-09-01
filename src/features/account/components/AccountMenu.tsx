"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RJ_CARD } from "@/components/ui/card";
import { USER_ROLES, type UserRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { signOutAction } from "@/features/auth/actions/auth.actions";
import { canViewDashboard } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import type { SessionUser } from "@/types/common.types";

const BASE_MENU_ITEMS = [
  { href: ROUTES.account, label: "My Account" },
  { href: ROUTES.orders, label: "Orders" },
  { href: ROUTES.profile, label: "Profile" },
] as const;

/** Links straight to the user's own portal — Admin and Seller each have a dedicated dashboard, not a shared one. */
function getMenuItems(role: UserRole) {
  if (!canViewDashboard(role)) return BASE_MENU_ITEMS;
  const dashboardHref = role === USER_ROLES.admin ? ROUTES.adminDashboard : ROUTES.sellerDashboard;
  return [...BASE_MENU_ITEMS, { href: dashboardHref, label: "Dashboard" }];
}

/**
 * Signed-in user popover for the shared site header (shop chrome). Closes on
 * outside click and Escape; keyboard-operable with `aria-expanded`/`role="menu"`.
 */
export function AccountMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials = getInitials(user.fullName ?? user.email);
  const menuItems = getMenuItems(user.role as UserRole);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-9 items-center gap-0.5 rounded-full px-1 transition-colors hover:bg-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rj-black text-[11px] font-bold text-rj-white">
          {initials}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-rj-gray-600 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className={cn(RJ_CARD, "absolute right-0 top-full z-50 mt-2 w-56 p-1.5 shadow-lg")}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-rj-black">
              {user.fullName ?? "My account"}
            </p>
            <p className="truncate text-xs text-rj-gray-600">{user.email}</p>
          </div>
          <div className="mt-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-rj-black transition-colors hover:bg-rj-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form
            action={signOutAction}
            className="mt-1 border-t border-rj-gray-100 pt-1.5"
          >
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-rj-red-dark transition-colors hover:bg-rj-gray-100"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
