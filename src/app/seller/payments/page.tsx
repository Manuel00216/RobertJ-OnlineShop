import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { PaymentsList } from "@/features/payments/components/PaymentsList";

export const metadata: Metadata = { title: "Payments — Seller Portal" };

function PaymentsListSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading payment history</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export default function SellerPaymentsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<PaymentsListSkeleton />}>
        <PaymentsList />
      </Suspense>
    </div>
  );
}
