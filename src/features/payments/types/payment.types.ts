import type { PaymentStatus } from "@/constants/status";

/** A payment attempt (COD collection, or Xendit online payment), as seen in payment history views. */
export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  /** Buyer display name (full name, falling back to username), or null. */
  buyerName: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodType: PaymentMethodType;
  /** GCASH / PAYMAYA / CARD — set once Xendit confirms the channel actually used. Null for COD. */
  paymentChannel: string | null;
  /** Xendit's hosted redirect/session URL, so an interrupted attempt can resume. Null for COD. */
  checkoutUrl: string | null;
  expiresAt: string | null;
  /** Supabase Storage object path for legacy QR receipts — historical only, never created for new payments. */
  receiptPath: string | null;
  failureReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/** Mirrors the DB `payment_method_type` enum. */
export type PaymentMethodType = "cod" | "card" | "qr_upload" | "xendit";

/**
 * The raw `payments` row returned directly by the Xendit/COD RPCs (no order
 * join) — used by the buyer-facing payment-creation flow, as opposed to
 * `Payment`, which is joined with order/buyer info for history views.
 */
export interface PaymentAttempt {
  id: string;
  orderId: string;
  status: PaymentStatus;
  paymentMethodType: PaymentMethodType;
  paymentChannel: string | null;
  amountCents: number;
  currency: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
  xenditPaymentRequestId: string | null;
  failureReason: string | null;
}
