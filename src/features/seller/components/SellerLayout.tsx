"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import type { SessionUser } from "@/types/common.types";

import { SellerSidebar } from "./SellerSidebar";
import { SellerTopbar, type SellerNotification } from "./SellerTopbar";

export interface SellerLayoutProps {
  user: SessionUser;
  notifications: readonly SellerNotification[];
  children: React.ReactNode;
}

/** Seller Portal shell — structural twin of AdminLayout. Never renders the buyer marketplace's SiteHeader/SiteFooter. */
export function SellerLayout({ user, notifications, children }: SellerLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div data-theme-scope="seller" className="flex min-h-screen bg-background">
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
        <SellerSidebar
          user={user}
          pathname={pathname}
          onNavigate={() => setSidebarOpen(false)}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <SellerTopbar
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
