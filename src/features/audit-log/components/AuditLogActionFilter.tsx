"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FILTER_CHIP_ACTIVE_THEMED as CHIP_ACTIVE,
  FILTER_CHIP_IDLE_THEMED as CHIP_IDLE,
} from "@/components/ui/filter-chip";
import {
  AUDIT_LOG_ACTIONS,
  AUDIT_LOG_ACTION_LABELS,
} from "@/features/audit-log/constants/audit-log.constants";

/** All/action chips for the audit log — mirrors `OrderStatusFilter`'s shape. Clears `page` on every change. */
export function AuditLogActionFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeAction = searchParams.get("action") ?? "";

  function updateParams(action: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (action) {
      params.set("action", action);
    } else {
      params.delete("action");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter audit log by action">
      <button
        type="button"
        aria-pressed={!activeAction}
        className={!activeAction ? CHIP_ACTIVE : CHIP_IDLE}
        onClick={() => updateParams(null)}
      >
        All
      </button>
      {AUDIT_LOG_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          aria-pressed={activeAction === action}
          className={activeAction === action ? CHIP_ACTIVE : CHIP_IDLE}
          onClick={() => updateParams(action)}
        >
          {AUDIT_LOG_ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  );
}
