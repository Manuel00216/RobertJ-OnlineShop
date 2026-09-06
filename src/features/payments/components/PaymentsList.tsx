import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { PaymentStatusBadge } from "@/features/orders/components/PaymentStatusBadge";
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

/**
 * Read-only payment history — no manual verification actions. Xendit
 * payments settle themselves via webhook, and COD is marked collected from
 * the order detail page; there's nothing left to manually decide here,
 * unlike the retired QR verification queue. Legacy `qr_upload` rows still
 * link to their original receipt for audit purposes.
 */
export async function PaymentsList() {
  let payments: Awaited<ReturnType<typeof listPaymentHistory>>;
  try {
    payments = await listPaymentHistory();
  } catch {
    return <ErrorState message="We couldn't load payment history right now." />;
  }

  if (payments.length === 0) {
    return (
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

          return (
            <li key={payment.id} className={cn(RJ_CARD, "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between")}>
              <div className="min-w-0">
                <Link
                  href={ROUTES.orderDetail(payment.orderId)}
                  className="text-sm font-bold text-rj-black hover:underline"
                >
                  {payment.orderNumber}
                </Link>
                <p className="mt-0.5 text-xs text-rj-gray-600">
                  {payment.buyerName ?? "Buyer"} · {formatDate(payment.createdAt)}
                </p>
                <p className="mt-0.5 text-xs text-rj-gray-600">
                  {METHOD_LABELS[payment.paymentMethodType] ?? payment.paymentMethodType}
                  {payment.paymentChannel ? ` · ${payment.paymentChannel}` : ""}
                </p>
                {payment.status === "failed" && payment.failureReason ? (
                  <p className="mt-0.5 text-xs text-rj-red-dark">{payment.failureReason}</p>
                ) : null}
                {receiptUrl ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-block text-xs font-semibold text-rj-red-dark hover:underline"
                  >
                    View receipt
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-rj-black">
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
