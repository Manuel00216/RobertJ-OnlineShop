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
 * Read-only payment status badge. Payment verification (COD / receipt checks)
 * is a checkout + Administrator-module concern, so this surface only displays.
 */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={PAYMENT_STATUS_TONE_MAP[status]}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
