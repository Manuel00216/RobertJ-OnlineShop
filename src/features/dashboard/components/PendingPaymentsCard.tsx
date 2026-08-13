import Link from "next/link";
import { Wallet } from "lucide-react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { listPendingPayments } from "@/lib/supabase/queries";

/**
 * The one real KPI on the Overview page: a count from the already-built,
 * already RLS-scoped `listPendingPayments()` (same function `VerificationQueue`
 * uses) — zero new queries, zero new RLS. Scoping (own orders-as-seller, or
 * all rows for admin) happens entirely server-side; this component passes no
 * ownership/shop parameter and never will.
 */
export async function PendingPaymentsCard() {
  let count: number;
  try {
    count = (await listPendingPayments()).length;
  } catch {
    return <ErrorState message="We couldn't load pending payments right now." />;
  }

  return (
    <Link href={ROUTES.paymentVerification} className="block">
      <Card className="border-rj-gray-100 transition-colors hover:border-rj-black">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rj-gray-50 text-rj-black">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-3xl leading-none text-rj-black">{count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-rj-gray-600">
              Pending payment verifications
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
