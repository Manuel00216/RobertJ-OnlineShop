import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/constants/roles";
import { getVisibleDashboardNav } from "@/features/dashboard/constants/nav";

/**
 * Presentational shortcuts grid for the Overview page — derived from the
 * same role-filtered nav list the sidebar uses, minus the Overview entry
 * itself. No fetching; "Coming soon" items are visually flagged, not hidden.
 */
export function DashboardShortcuts({ role }: { role: UserRole }) {
  const items = getVisibleDashboardNav(role).filter((item) => item.href !== ROUTES.dashboard);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ href, label, icon: Icon, status }) => (
        <Link key={href} href={href} className="block">
          <Card className="h-full border-rj-gray-100 transition-colors hover:border-rj-black">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rj-gray-50 text-rj-black">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                {status === "comingSoon" ? <Badge tone="neutral">Coming soon</Badge> : null}
              </div>
              <p className="text-sm font-semibold text-rj-black">{label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
