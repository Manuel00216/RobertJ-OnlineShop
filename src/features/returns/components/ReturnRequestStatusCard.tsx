import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { RJ_CARD } from "@/components/ui/card";
import { RETURN_STATUS, RETURN_STATUS_LABELS, type ReturnStatus } from "@/constants/status";
import type { ReturnRequest } from "@/features/returns/types/return.types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

const RETURN_STATUS_TONE: Record<ReturnStatus, "neutral" | "info" | "success" | "danger"> = {
  pending: "neutral",
  seller_accepted: "info",
  seller_rejected: "danger",
  admin_rejected: "danger",
  refunded: "success",
};

export interface ReturnRequestStatusCardProps {
  request: ReturnRequest;
  /** Pre-resolved signed URL (bucket is private) for `request.evidencePath`, or null if none/failed to load. */
  evidenceUrl: string | null;
}

/**
 * Display-only summary of one return request — reused on the buyer's order
 * page, the seller's dashboard order page (alongside `RespondToReturnPanel`),
 * and the admin queue. No actions live here; each surface composes its own
 * action panel next to this card.
 */
export function ReturnRequestStatusCard({
  request,
  evidenceUrl,
}: ReturnRequestStatusCardProps) {
  return (
    <section aria-label="Return/refund request" className={cn(RJ_CARD, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
          {request.orderItemTitle ? `Return: ${request.orderItemTitle}` : "Return request"}
        </h2>
        <Badge tone={RETURN_STATUS_TONE[request.status]}>
          {RETURN_STATUS_LABELS[request.status]}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-rj-gray-600">
        Requested {formatDate(request.createdAt)}
        {request.buyerName ? ` by ${request.buyerName}` : ""}
      </p>
      <p className="mt-2 text-sm text-rj-black">{request.reason}</p>

      {evidenceUrl ? (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="relative mt-3 block h-32 w-32 overflow-hidden rounded-xl border border-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        >
          {/* unoptimized: a short-lived signed Storage URL, not a stable path next/image should cache/optimize. */}
          <Image src={evidenceUrl} alt="Return evidence" fill unoptimized className="object-cover" />
        </a>
      ) : null}

      {request.sellerDecisionNote ? (
        <p className="mt-3 border-t border-rj-gray-100 pt-3 text-xs text-rj-gray-600">
          <span className="font-semibold text-rj-black">Seller response:</span>{" "}
          {request.sellerDecisionNote}
        </p>
      ) : null}

      {request.adminDecisionNote ? (
        <p className="mt-2 text-xs text-rj-gray-600">
          <span className="font-semibold text-rj-black">Admin decision:</span>{" "}
          {request.adminDecisionNote}
        </p>
      ) : null}

      {request.status === RETURN_STATUS.refunded && request.refundAmountCents !== null ? (
        <p className="mt-3 text-sm font-semibold text-rj-green">
          Refunded {formatCurrency(request.refundAmountCents, request.currency)}
        </p>
      ) : null}
    </section>
  );
}
