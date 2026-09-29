"use client";

import { useState } from "react";

import { RJ_CARD } from "@/components/ui/card";
import { ConfirmReceivedButton } from "@/features/orders/components/ConfirmReceivedButton";
import { ReportProblemPanel } from "@/features/returns/components/ReportProblemPanel";
import { cn } from "@/lib/utils/cn";

export interface DeliveryResolutionChoiceProps {
  orderId: string;
  orderNumber: string;
}

/**
 * Shown on a delivered order once no return request is open and the buyer
 * hasn't yet confirmed receipt — the two mutually exclusive choices
 * ("everything's fine" vs. "something's wrong"), matching the approved
 * design. Report a Problem starts collapsed behind its own button so the two
 * paths read as parallel choices, not one primary and one buried action.
 */
export function DeliveryResolutionChoice({ orderId, orderNumber }: DeliveryResolutionChoiceProps) {
  const [reporting, setReporting] = useState(false);

  if (reporting) {
    return <ReportProblemPanel orderId={orderId} onCancel={() => setReporting(false)} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className={cn(RJ_CARD, "flex flex-col gap-2 p-5")}>
        <p className="text-sm font-bold text-rj-black">Everything arrived as expected?</p>
        <p className="text-xs text-rj-gray-600">
          Confirming closes out this order — you can still leave a review afterward.
        </p>
        <div className="mt-1">
          <ConfirmReceivedButton orderId={orderId} orderNumber={orderNumber} />
        </div>
      </div>
      <div className={cn(RJ_CARD, "flex flex-col gap-2 p-5")}>
        <p className="text-sm font-bold text-rj-black">Something wrong with this order?</p>
        <p className="text-xs text-rj-gray-600">
          Non-delivery, wrong or damaged item, missing item, or anything else — tell us what happened.
        </p>
        <button
          type="button"
          className="mt-1 w-fit rounded-full border-[1.5px] border-rj-black px-6 py-2 text-[12px] font-bold text-rj-black transition-colors hover:bg-rj-black hover:text-rj-white"
          onClick={() => setReporting(true)}
        >
          Report a Problem
        </button>
      </div>
    </div>
  );
}
