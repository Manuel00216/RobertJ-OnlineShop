import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { VerificationQueue } from "@/features/payments/components/VerificationQueue";

export const metadata: Metadata = { title: "Payment Verification" };

function VerificationQueueSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading pending payments</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-32 w-full rounded-2xl bg-rj-gray-100" />
      ))}
    </div>
  );
}

export default function PaymentVerificationPage() {
  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Dashboard"
        title="Payment Verification"
        description="Review QR receipt submissions and mark payments verified or rejected."
      />
      <Suspense fallback={<VerificationQueueSkeleton />}>
        <VerificationQueue />
      </Suspense>
    </div>
  );
}
