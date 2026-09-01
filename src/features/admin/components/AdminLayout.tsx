"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import type { SessionUser } from "@/types/common.types";

import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar, type AdminNotification } from "./AdminTopbar";

export interface AdminLayoutProps {
  user: SessionUser;
  notifications: readonly AdminNotification[];
  children: React.ReactNode;
}

/** Admin Portal shell — sidebar + topbar + content, ported from the Figma Admin Portal design. Never renders the buyer marketplace's SiteHeader/SiteFooter. */
export function AdminLayout({ user, notifications, children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AdminSidebar
          user={user}
          pathname={pathname}
          onNavigate={() => setSidebarOpen(false)}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          user={user}
          pathname={pathname}
          notifications={notifications}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
