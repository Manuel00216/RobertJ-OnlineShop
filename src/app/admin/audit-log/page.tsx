import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogTable } from "@/features/audit-log/components/AuditLogTable";
import { listAdminActionLog } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Audit Log — Admin Portal" };

function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading audit log</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

async function AuditLogData() {
  const entries = await listAdminActionLog();
  return <AuditLogTable entries={entries} />;
}

export default function AdminAuditLogPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<AuditLogSkeleton />}>
        <AuditLogData />
      </Suspense>
    </div>
  );
}
