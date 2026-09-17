"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PAYMENT_STATUS, PAYMENT_STATUS_LABELS } from "@/constants/status";
import type { PaymentStatus } from "@/constants/status";

const CHIP_ACTIVE =
  "rounded-full border-[1.5px] border-rj-black bg-rj-black px-4 py-1.5 text-[11px] font-bold text-rj-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";
const CHIP_IDLE =
  "rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-4 py-1.5 text-[11px] font-bold text-rj-gray-600 transition-all hover:border-rj-black hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";

const STATUS_CHIPS = Object.values(PAYMENT_STATUS) as PaymentStatus[];

/**
 * Phase 4B, Admin-only. Status chips for the Admin payments view — same
 * "set `status`, replace, no page param" shape as `OrderStatusFilter`.
 * Not rendered on the Seller payments page, so seller behavior is unchanged.
 */
export function PaymentStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStatus = searchParams.get("status") ?? "";

  function updateParams(status: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter payments by status"
    >
      <button
        type="button"
        aria-pressed={!activeStatus}
        className={!activeStatus ? CHIP_ACTIVE : CHIP_IDLE}
        onClick={() => updateParams(null)}
      >
        All
      </button>
      {STATUS_CHIPS.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={activeStatus === status}
          className={activeStatus === status ? CHIP_ACTIVE : CHIP_IDLE}
          onClick={() => updateParams(status)}
        >
          {PAYMENT_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
