import Link from "next/link";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { RETURN_STATUS } from "@/constants/status";
import { DecideReturnPanel } from "@/features/returns/components/DecideReturnPanel";
import { ReturnRequestStatusCard } from "@/features/returns/components/ReturnRequestStatusCard";
import { getReturnEvidenceSignedUrl, listReturnRequests } from "@/lib/supabase/queries";

/**
 * Server Component: every return request visible to the caller (RLS scopes
 * to admin = all, seller = own-shop's — this page is admin-only per its
 * route guard, but the query/component are role-agnostic, matching
 * `VerificationQueue`'s shape), each with its evidence photo's signed URL
 * resolved up front since the bucket is private.
 */
export async function ReturnQueue() {
  let requests;
  try {
    requests = await listReturnRequests();
  } catch {
    return <ErrorState message="We couldn't load return requests right now." />;
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No return or refund requests"
        description="Requests appear here once a seller has accepted or rejected them."
      />
    );
  }

  const withEvidence = await Promise.all(
    requests.map(async (request) => ({
      request,
      evidenceUrl: request.evidencePath
        ? await getReturnEvidenceSignedUrl(request.evidencePath).catch(() => null)
        : null,
    })),
  );

  return (
    <ul className="flex flex-col gap-3">
      {withEvidence.map(({ request, evidenceUrl }) => (
        <li key={request.id} className="flex flex-col gap-2">
          <Link
            href={ROUTES.adminOrderDetail(request.orderId)}
            className="text-xs font-semibold text-rj-black hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
          >
            {request.orderNumber} →
          </Link>
          <ReturnRequestStatusCard request={request} evidenceUrl={evidenceUrl} />
          {request.status === RETURN_STATUS.sellerAccepted ||
          request.status === RETURN_STATUS.sellerRejected ? (
            <DecideReturnPanel
              returnId={request.id}
              sellerRejected={request.status === RETURN_STATUS.sellerRejected}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
