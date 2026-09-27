import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogActionFilter } from "@/features/audit-log/components/AuditLogActionFilter";
import { AuditLogTable } from "@/features/audit-log/components/AuditLogTable";
import { isAuditLogAction } from "@/features/audit-log/constants/audit-log.constants";
import { PaginationControls } from "@/features/products/components/PaginationControls";
import { listAdminActionLog } from "@/lib/supabase/queries";
import { paginationSchema } from "@/lib/validations/common.schema";

export const metadata: Metadata = { title: "Audit Log — Admin Portal" };

function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading audit log</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

interface AuditLogDataProps {
  action: string | null;
  page: number;
  pageSize: number;
}

/** L3: paginated + optionally filtered by action — see `listAdminActionLog`'s doc comment. Ordering and the underlying records are unchanged. */
async function AuditLogData({ action, page, pageSize }: AuditLogDataProps) {
  const result = await listAdminActionLog({
    page,
    pageSize,
    action: action ?? undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <AuditLogTable entries={result.items} filtering={Boolean(action)} />
      {result.totalPages > 1 ? (
        <PaginationControls page={result.page} totalPages={result.totalPages} themed />
      ) : null}
    </div>
  );
}

interface AdminAuditLogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminAuditLogPage({ searchParams }: AdminAuditLogPageProps) {
  const params = await searchParams;
  const actionParam = typeof params.action === "string" ? params.action : null;
  const action = isAuditLogAction(actionParam) ? actionParam : null;

  const parsed = paginationSchema.safeParse(params);
  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-6 p-5 lg:p-7">
        <ErrorState message="Those filters aren't valid. Try clearing your search." />
      </div>
    );
  }
  const { page, pageSize } = parsed.data;

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={null}>
        <AuditLogActionFilter />
      </Suspense>

      <Suspense key={JSON.stringify(params)} fallback={<AuditLogSkeleton />}>
        <AuditLogData action={action} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
