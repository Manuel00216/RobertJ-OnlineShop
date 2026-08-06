"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { OrderStatus } from "@/constants/status";
import {
  getOrderStatusLabel,
  ORDER_STATUS_FLOW,
} from "@/features/orders/constants/order.constants";

const CHIP_ACTIVE =
  "rounded-full border-[1.5px] border-rj-black bg-rj-black px-4 py-1.5 text-[11px] font-bold text-rj-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";
const CHIP_IDLE =
  "rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-4 py-1.5 text-[11px] font-bold text-rj-gray-600 transition-all hover:border-rj-black hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";

/** Status chips for the order history. Sets `status`, always clears `page`. */
export function OrderStatusFilter() {
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
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter orders by status"
    >
      <button
        type="button"
        aria-pressed={!activeStatus}
        className={!activeStatus ? CHIP_ACTIVE : CHIP_IDLE}
        onClick={() => updateParams(null)}
      >
        All
      </button>
      {ORDER_STATUS_FLOW.map((status: OrderStatus) => (
        <button
          key={status}
          type="button"
          aria-pressed={activeStatus === status}
          className={activeStatus === status ? CHIP_ACTIVE : CHIP_IDLE}
          onClick={() => updateParams(status)}
        >
          {getOrderStatusLabel(status)}
        </button>
      ))}
    </div>
  );
}
