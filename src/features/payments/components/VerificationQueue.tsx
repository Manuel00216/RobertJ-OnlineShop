import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { VerificationCard } from "@/features/payments/components/VerificationCard";
import {
  getPaymentReceiptSignedUrl,
  listPendingPayments,
} from "@/lib/supabase/queries";

/**
 * Server Component: fetches pending payments (RLS already scopes to the
 * caller's own orders-as-seller, or all rows for an admin) and resolves each
 * receipt's signed URL up front, since the bucket is private.
 */
export async function VerificationQueue() {
  let payments: Awaited<ReturnType<typeof listPendingPayments>>;
  try {
    payments = await listPendingPayments();
  } catch {
    return <ErrorState message="We couldn't load pending payments right now." />;
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        title="No payments awaiting verification"
        description="New QR receipt submissions will appear here."
      />
    );
  }

  const withReceiptUrls = await Promise.all(
    payments.map(async (payment) => ({
      payment,
      receiptUrl: payment.receiptPath
        ? await getPaymentReceiptSignedUrl(payment.receiptPath).catch(() => null)
        : null,
    })),
  );

  return (
    <ul className="flex flex-col gap-3">
      {withReceiptUrls.map(({ payment, receiptUrl }) => (
        <li key={payment.id}>
          <VerificationCard payment={payment} receiptUrl={receiptUrl} />
        </li>
      ))}
    </ul>
  );
}
