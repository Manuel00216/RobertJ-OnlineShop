import type { Payment } from "@/features/payments/types/payment.types";

const CHANNEL_LABELS: Record<string, string> = {
  GCASH: "GCash",
  PAYMAYA: "Maya",
  CARD: "Card",
};

/**
 * `orders` has no payment-method column — only the separate `payments` table
 * records that, and only for Xendit orders — so no payment row at all means
 * COD. Shared by the order-detail and cancellation-detail pages so the two
 * never describe the same order's payment differently.
 */
export function paymentMethodLabel(activePayment: Payment | null): string {
  if (!activePayment) return "Cash on Delivery";
  if (activePayment.status === "paid") {
    const channel = activePayment.paymentChannel
      ? (CHANNEL_LABELS[activePayment.paymentChannel] ?? activePayment.paymentChannel)
      : "Online Payment";
    return `Paid via ${channel}`;
  }
  if (activePayment.status === "refunded" || activePayment.status === "partially_refunded") {
    return "Refunded";
  }
  return "Unpaid";
}
