import type { PaymentStatus } from "@/constants/status";

/** A QR payment submission, as seen by the seller/admin verification queue. */
export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  /** Buyer display name (full name, falling back to username), or null. */
  buyerName: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  /** Supabase Storage object path — resolve via `getPaymentReceiptSignedUrl`, never render directly. */
  receiptPath: string | null;
  failureReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/** The only two outcomes `verify_payment` accepts — never "pending" (that's the starting state). */
export type PaymentDecision = "paid" | "failed";
