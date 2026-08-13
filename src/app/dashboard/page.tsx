import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@/constants/roles";
import { DashboardShortcuts } from "@/features/dashboard/components/DashboardShortcuts";
import { PendingPaymentsCard } from "@/features/dashboard/components/PendingPaymentsCard";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Dashboard" };

function PendingPaymentsCardSkeleton() {
  return <Skeleton className="h-24 w-full rounded-2xl bg-rj-gray-100" aria-label="Loading pending payments" />;
}

export default async function DashboardOverviewPage() {
  const user = await requireSessionUser();
  const role = user.role as UserRole;

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title={`Welcome back${user.fullName ? `, ${user.fullName}` : ""}`}
        description="Your shop and platform tools, in one place."
      />
      <Suspense fallback={<PendingPaymentsCardSkeleton />}>
        <PendingPaymentsCard />
      </Suspense>
      <DashboardShortcuts role={role} />
    </div>
  );
}
