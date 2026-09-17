import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_STATUS } from "@/constants/status";
import type { PaymentStatus } from "@/constants/status";
import { PaymentsList } from "@/features/payments/components/PaymentsList";
import { PaymentStatusFilter } from "@/features/payments/components/PaymentStatusFilter";

export const metadata: Metadata = { title: "Payments — Admin Portal" };

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

const VALID_STATUSES: readonly string[] = Object.values(PAYMENT_STATUS);

/** Only an exact `payment_status` enum value passes through as a DB filter — anything else is treated as "no filter". */
function parseStatusParam(value: string | string[] | undefined): PaymentStatus | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && VALID_STATUSES.includes(raw) ? (raw as PaymentStatus) : undefined;
}

interface AdminPaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const params = await searchParams;
  const status = parseStatusParam(params.status);

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={null}>
        <PaymentStatusFilter />
      </Suspense>
      <Suspense key={status ?? "all"} fallback={<PaymentsListSkeleton />}>
        <PaymentsList status={status} showAdminTools />
      </Suspense>
    </div>
  );
}
