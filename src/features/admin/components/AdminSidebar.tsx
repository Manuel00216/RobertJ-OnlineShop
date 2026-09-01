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
          ? "border-sidebar-accent bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-transparent text-sidebar-muted-foreground hover:bg-sidebar-border/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("h-4.5 w-4.5 flex-shrink-0", active && "text-sidebar-accent-foreground")} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sidebar-accent-foreground" />}
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
    <div className="flex h-full flex-col select-none border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-sidebar-border px-5">
        <Link href={ROUTES.adminDashboard} className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-danger text-xs font-bold text-primary-foreground">
            RJ
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight text-sidebar-foreground">
              RobertJ
            </span>
            <span className="text-[10px] font-medium leading-tight text-sidebar-muted-foreground">
              Admin Portal
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-sidebar-muted-foreground transition-colors hover:text-sidebar-foreground lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close sidebar</span>
        </button>
      </div>

      <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" onClick={onNavigate}>
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
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

      <div className="flex-shrink-0 border-t border-sidebar-border px-3 py-4">
        <div className="mb-2 flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-sidebar-accent-foreground/30 bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight text-sidebar-foreground">
              {user.fullName ?? user.email}
            </p>
            <p className="truncate text-[10px] leading-tight text-sidebar-muted-foreground">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-sidebar-muted-foreground transition-all duration-150 hover:border-danger/20 hover:bg-sidebar-border/50 hover:text-danger"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
