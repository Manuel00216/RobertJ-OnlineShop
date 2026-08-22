import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { AuditLogTable } from "@/features/audit-log/components/AuditLogTable";
import { listAdminActionLog, requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Audit Log — Dashboard" };

function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading audit log</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl bg-rj-gray-100" />
      ))}
    </div>
  );
}

async function AuditLogData() {
  const entries = await listAdminActionLog();
  return <AuditLogTable entries={entries} />;
}

/** Admin-only: the shared layout only requires seller-or-admin, so this page re-checks. */
export default async function DashboardAuditLogsPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Audit Log"
        description="High-stakes administrative actions — account status, refund decisions, seller assignment."
      />
      <Suspense fallback={<AuditLogSkeleton />}>
        <AuditLogData />
      </Suspense>
    </div>
  );
}
