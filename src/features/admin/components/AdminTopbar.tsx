"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

import { ROLE_LABELS, type UserRole } from "@/constants/roles";
import { signOutAction } from "@/features/auth/actions/auth.actions";
import { getAdminPageMeta } from "@/features/admin/constants/nav";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import type { SessionUser } from "@/types/common.types";

export interface AdminNotification {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "danger" | "info";
}

const TONE_DOT: Record<AdminNotification["tone"], string> = {
  warning: "bg-amber-400",
  danger: "bg-red-400",
  info: "bg-blue-400",
};

export interface AdminTopbarProps {
  user: SessionUser;
  pathname: string;
  notifications: readonly AdminNotification[];
  onMenuClick: () => void;
}

/** Light topbar for the Admin Portal — ported from the Figma design, with notifications sourced from real pending-work counts instead of mock data. */
export function AdminTopbar({ user, pathname, notifications, onMenuClick }: AdminTopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { title, subtitle } = getAdminPageMeta(pathname);
  const initials = getInitials(user.fullName ?? user.email);
  const role = user.role as UserRole;

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex-shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Open sidebar</span>
      </button>

      <div className="hidden flex-shrink-0 lg:block">
        <h1 className="text-base font-semibold leading-tight text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs leading-tight text-gray-400">{subtitle}</p> : null}
      </div>
      <h1 className="flex-1 text-base font-semibold text-gray-900 lg:hidden">{title}</h1>

      <div className="ml-4 hidden max-w-md flex-1 md:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications((v) => !v);
              setShowProfile(false);
            }}
            className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
            <span className="sr-only">Notifications</span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {notifications.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    {notifications.length} new
                  </span>
                )}
              </div>
              <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">You&apos;re all caught up.</p>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                      onClick={() => setShowNotifications(false)}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", TONE_DOT[n.tone])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{n.description}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfile((v) => !v);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1 pr-2 transition-colors hover:bg-gray-100"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-xs font-semibold text-indigo-600">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-gray-900">{user.fullName ?? user.email}</p>
              <p className="text-[10px] leading-tight text-gray-400">{ROLE_LABELS[role]}</p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 sm:block" aria-hidden="true" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{user.fullName ?? "Administrator"}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <form action={signOutAction} className="border-t border-gray-100 py-1.5">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {(showNotifications || showProfile) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowProfile(false);
          }}
        />
      )}
    </header>
  );
}
