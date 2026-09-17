import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { THEMED_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { PaymentStatus } from "@/constants/status";
import { PaymentStatusBadge } from "@/features/orders/components/PaymentStatusBadge";
import { isStaleXenditAttempt } from "@/features/payments/lib/xendit-reconciliation";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { getPaymentReceiptSignedUrl, listPaymentHistory } from "@/lib/supabase/queries";

const METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  xendit: "Online Payment",
  qr_upload: "QR Transfer (legacy)",
  card: "Card (legacy)",
};

export interface PaymentsListProps {
  /** Narrows the list to one payment status. Omitted = unfiltered (unchanged default behavior). */
  status?: PaymentStatus;
  /**
   * Phase 4B, Admin-only extras (stale/multi-seller indicators). Defaults to
   * false so the Seller payments page — which renders this same component
   * with no props — is visually unchanged.
   */
  showAdminTools?: boolean;
}

/**
 * Read-only payment history — no manual verification actions. Xendit
 * payments settle themselves via webhook, and COD is marked collected from
 * the order detail page; there's nothing left to manually decide here,
 * unlike the retired QR verification queue. Legacy `qr_upload` rows still
 * link to their original receipt for audit purposes.
 */
export async function PaymentsList({ status, showAdminTools = false }: PaymentsListProps = {}) {
  let payments: Awaited<ReturnType<typeof listPaymentHistory>>;
  try {
    payments = await listPaymentHistory(50, status);
  } catch {
    return <ErrorState message="We couldn't load payment history right now." />;
  }

  if (payments.length === 0) {
    return status ? (
      <EmptyState
        title="No matching payments"
        description="Try a different status filter."
      />
    ) : (
      <EmptyState title="No payments yet" description="Payments will appear here once orders come in." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {await Promise.all(
        payments.map(async (payment) => {
          const receiptUrl =
            payment.paymentMethodType === "qr_upload" && payment.receiptPath
              ? await getPaymentReceiptSignedUrl(payment.receiptPath).catch(() => null)
              : null;

          // Phase 4B: only meaningful for a still-pending Xendit attempt that
          // Xendit actually acknowledged — reuses the exact fix
          // #5A/#5B/cron staleness window, no new logic. A row with no
          // `xenditPaymentRequestId` (checkout abandoned before Xendit ever
          // responded) is never a reconciliation candidate — see
          // `getStaleXenditPaymentsForReconciliationSweep` and
          // `reconcileStaleXenditAttempt`'s own early return — so it must
          // never claim to be "awaiting reconciliation" no matter its age.
          const isStale =
            showAdminTools &&
            payment.paymentMethodType === "xendit" &&
            payment.status === "pending" &&
            payment.xenditPaymentRequestId != null &&
            isStaleXenditAttempt(payment);
          const isMultiSeller = showAdminTools && Boolean(payment.checkoutGroupId);

          return (
            <li key={payment.id} className={cn(THEMED_CARD, "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between")}>
              <div className="min-w-0">
                <Link
                  href={ROUTES.orderDetail(payment.orderId)}
                  className="text-sm font-bold text-foreground hover:underline"
                >
                  {payment.orderNumber}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {payment.buyerName ?? "Buyer"} · {formatDate(payment.createdAt)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {METHOD_LABELS[payment.paymentMethodType] ?? payment.paymentMethodType}
                  {payment.paymentChannel ? ` · ${payment.paymentChannel}` : ""}
                </p>
                {payment.status === "failed" && payment.failureReason ? (
                  <p className="mt-0.5 text-xs text-danger">{payment.failureReason}</p>
                ) : null}
                {receiptUrl ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-block text-xs font-semibold text-danger hover:underline"
                  >
                    View receipt
                  </a>
                ) : null}
                {isMultiSeller || isStale ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {isMultiSeller ? <Badge tone="neutral">Multi-seller order</Badge> : null}
                    {isStale ? <Badge tone="warning">Stale — awaiting reconciliation</Badge> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(payment.amountCents, payment.currency)}
                </span>
                <PaymentStatusBadge status={payment.status} />
              </div>
            </li>
          );
        }),
      )}
    </ul>
  );
}
