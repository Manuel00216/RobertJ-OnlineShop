import type { ReturnStatus } from "@/constants/status";

/**
 * Domain model for one return/refund request. See `decide_return`'s doc
 * comment (`supabase/migrations/20260826000000_returns_and_refunds.sql`) for
 * the full state machine — there is no separate "admin approved" state;
 * approval and the refund are one atomic transition to `refunded`.
 */
export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  /** Null = whole-order return. */
  orderItemId: string | null;
  orderItemTitle: string | null;
  buyerId: string;
  buyerName: string | null;
  sellerId: string;
  reason: string;
  /** Storage path in the payment-receipts bucket — resolve via `getReturnEvidenceSignedUrl`, never render directly. */
  evidencePath: string | null;
  status: ReturnStatus;
  sellerDecisionNote: string | null;
  sellerDecidedAt: string | null;
  adminDecisionNote: string | null;
  adminDecidedAt: string | null;
  /** Set only once the request reaches `refunded`. */
  refundAmountCents: number | null;
  createdAt: string;
}

/** The only two outcomes `respond_to_return` accepts. */
export type SellerReturnDecision = "accept" | "reject";
/** The only two outcomes `decide_return` accepts. */
export type AdminReturnDecision = "approve" | "reject";
