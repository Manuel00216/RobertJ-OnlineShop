"use client";

import Link from "next/link";
import { LogOut, X } from "lucide-react";

import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/features/admin/constants/nav";
import { ROLE_LABELS, type UserRole } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { signOutAction } from "@/features/auth/actions/auth.actions";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import type { SessionUser } from "@/types/common.types";

function NavLink({ item, active }: { item: AdminNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "border-indigo-500/20 bg-indigo-500/15 text-indigo-300"
          : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
      )}
    >
      <Icon className={cn("h-4.5 w-4.5 flex-shrink-0", active && "text-indigo-400")} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />}
    </Link>
  );
}

export interface AdminSidebarProps {
  user: SessionUser;
  pathname: string;
  onNavigate?: () => void;
  onClose: () => void;
}

/** Dark, grouped admin navigation — ported from the Figma Admin Portal design, wired to real routes instead of client-side section state. */
export function AdminSidebar({ user, pathname, onNavigate, onClose }: AdminSidebarProps) {
  const initials = getInitials(user.fullName ?? user.email);
  const role = user.role as UserRole;

  return (
    <div className="flex h-full flex-col select-none border-r border-slate-800 bg-slate-900">
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-800 px-5">
        <Link href={ROUTES.adminDashboard} className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
          >
            RJ
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight text-white">RobertJ</span>
            <span className="text-[10px] font-medium leading-tight text-slate-500">Admin Portal</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 transition-colors hover:text-slate-300 lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close sidebar</span>
        </button>
      </div>

      <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" onClick={onNavigate}>
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== ROUTES.adminDashboard && pathname.startsWith(`${item.href}/`));
                return <NavLink key={item.href} item={item} active={active} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 border-t border-slate-800 px-3 py-4">
        <div className="mb-2 flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/20 text-xs font-semibold text-indigo-400">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight text-slate-300">
              {user.fullName ?? user.email}
            </p>
            <p className="truncate text-[10px] leading-tight text-slate-600">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-slate-500 transition-all duration-150 hover:border-red-500/10 hover:bg-slate-800 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
