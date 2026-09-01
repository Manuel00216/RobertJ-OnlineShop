import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { ReturnQueue } from "@/features/returns/components/ReturnQueue";

export const metadata: Metadata = { title: "Returns & Refunds — Admin Portal" };

function ReturnQueueSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading return requests</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

/**
 * Reviews return requests a seller has already responded to, and decides the refund.
 * Authorization is enforced once by `src/app/admin/layout.tsx` (`requireRole(ADMIN_ONLY_ROLES)`).
 */
export default function AdminReturnsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<ReturnQueueSkeleton />}>
        <ReturnQueue />
      </Suspense>
    </div>
  );
}
