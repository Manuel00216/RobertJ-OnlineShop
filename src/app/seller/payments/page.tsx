import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { VerificationQueue } from "@/features/payments/components/VerificationQueue";

export const metadata: Metadata = { title: "Payments — Seller Portal" };

function VerificationQueueSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading pending payments</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export default function SellerPaymentsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<VerificationQueueSkeleton />}>
        <VerificationQueue />
      </Suspense>
    </div>
  );
}
