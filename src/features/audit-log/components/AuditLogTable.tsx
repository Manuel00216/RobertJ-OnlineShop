import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { AdminActionLogEntry } from "@/features/audit-log/types/audit-log.types";
import { formatDateTime } from "@/lib/utils/date";

/**
 * Known actions get a friendly label + tone; anything else (a future RPC
 * that starts logging) falls back to the raw action string — never hidden,
 * never crashes on an unrecognized value.
 */
const ACTION_LABELS: Record<string, string> = {
  assign_seller_shop: "Assigned seller to shop",
  deactivate_user: "Deactivated account",
  reactivate_user: "Reactivated account",
  approve_refund: "Approved refund",
  reject_refund: "Rejected return request",
};

const ACTION_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = {
  assign_seller_shop: "info",
  deactivate_user: "danger",
  reactivate_user: "success",
  approve_refund: "success",
  reject_refund: "danger",
};

export interface AuditLogTableProps {
  entries: AdminActionLogEntry[];
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No administrative actions logged yet"
        description="High-stakes actions — account deactivation, refund decisions, seller/shop assignment — will appear here as they happen."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <Card key={entry.id} className="border-rj-gray-100">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ACTION_TONE[entry.action] ?? "neutral"}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm text-rj-black">
                <span className="font-semibold">{entry.actorName ?? "Unknown admin"}</span>
                {entry.targetUserName ? (
                  <>
                    {" "}
                    → <span className="font-semibold">{entry.targetUserName}</span>
                  </>
                ) : null}
                {entry.targetShopName ? (
                  <>
                    {" "}
                    (<span className="font-semibold">{entry.targetShopName}</span>)
                  </>
                ) : null}
              </p>
            </div>
            <p className="shrink-0 text-xs text-rj-gray-600">{formatDateTime(entry.createdAt)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
