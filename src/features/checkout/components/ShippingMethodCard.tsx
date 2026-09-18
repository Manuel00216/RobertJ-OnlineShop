import { Truck } from "lucide-react";

import { RJ_CARD } from "@/components/ui/card";
import { CHECKOUT_CONSTANTS, CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import { cn } from "@/lib/utils/cn";

/**
 * The checkout's delivery-method display. There's only one method today (no
 * courier API/live tracking — SAD Out of Scope), so this states it as a
 * fact rather than a selectable radio group. Copy is sourced entirely from
 * `CHECKOUT_CONSTANTS`/`CHECKOUT_COPY` — the single place to change it,
 * rather than a string hardcoded here or repeated elsewhere.
 */
export function ShippingMethodCard() {
  return (
    <section aria-label={CHECKOUT_COPY.shippingSectionTitle} className={cn(RJ_CARD, "p-5")}>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        {CHECKOUT_COPY.shippingSectionTitle}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rj-gray-100">
          <Truck className="h-4 w-4 text-rj-black" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rj-black">
            {CHECKOUT_CONSTANTS.standardDeliveryLabel}
          </p>
          <p className="mt-0.5 text-xs text-rj-gray-600">
            {CHECKOUT_CONSTANTS.standardDeliveryEstimate}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-rj-green">
          {CHECKOUT_COPY.shippingFreeLabel}
        </span>
      </div>
    </section>
  );
}
