import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_LABELS } from "@/constants/status";
import type { PaymentStatus } from "@/constants/status";

/** Badge tone per payment status — the label is the primary signal. */
const PAYMENT_STATUS_TONE_MAP: Record<
  PaymentStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  pending: "info",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
};

/**
 * Structurally identical to `PaymentMethodType` (`features/payments/types`)
 * and `Order.paymentMethod` — declared locally rather than imported to avoid
 * a cross-feature type dependency for a component that only ever compares
 * against `"cod"`. Optional: callers that don't know the payment method yet
 * (or where it's irrelevant) simply omit it and get the generic label.
 */
export type BadgePaymentMethod = "cod" | "xendit" | "card" | "qr_upload";

export interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  /** When provided and the order is COD, "pending" reads as "Pay on delivery" instead of the generic "Payment pending" — COD sitting unpaid through its whole fulfilment cycle is normal, not a signal something needs fixing (unlike a stalled online payment). */
  paymentMethod?: BadgePaymentMethod;
}

/**
 * Read-only payment status badge. Payment verification (COD / receipt checks)
 * is a checkout + Administrator-module concern, so this surface only displays.
 */
export function PaymentStatusBadge({ status, paymentMethod }: PaymentStatusBadgeProps) {
  const label =
    status === "pending" && paymentMethod === "cod" ? "Pay on delivery" : PAYMENT_STATUS_LABELS[status];

  return (
    <Badge tone={PAYMENT_STATUS_TONE_MAP[status]}>
      {label}
    </Badge>
  );
}
