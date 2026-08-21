import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ONLY_ROLES } from "@/constants/roles";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ReturnQueue } from "@/features/returns/components/ReturnQueue";
import { requireRole } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Returns & Refunds — Dashboard" };

function ReturnQueueSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading return requests</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-2xl bg-rj-gray-100" />
      ))}
    </div>
  );
}

/**
 * Admin-only: sellers respond to their own return requests inline on their
 * own order detail page (`RespondToReturnPanel`), not from a separate
 * top-level nav item — this queue is where the *escalated* decision
 * (approve/reject after the seller has already responded) happens.
 */
export default async function DashboardReturnsPage() {
  await requireRole(ADMIN_ONLY_ROLES);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Returns & Refunds"
        description="Review return requests a seller has already responded to, and decide the refund."
      />
      <Suspense fallback={<ReturnQueueSkeleton />}>
        <ReturnQueue />
      </Suspense>
    </div>
  );
}
