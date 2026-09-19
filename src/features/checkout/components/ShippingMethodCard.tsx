import { Truck } from "lucide-react";

import { CHECKOUT_CONSTANTS, CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";

/**
 * The checkout's delivery-method display, as a single inline row rather than
 * its own bordered card — sits inside the parent sheet's divider list. There's
 * only one method today (no courier API/live tracking — SAD Out of Scope),
 * so this states it as a fact rather than a selectable radio group. Copy is
 * sourced entirely from `CHECKOUT_CONSTANTS`/`CHECKOUT_COPY` — the single
 * place to change it, rather than a string hardcoded here or repeated
 * elsewhere.
 */
export function ShippingMethodCard() {
  return (
    <section
      aria-label={CHECKOUT_COPY.shippingSectionTitle}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm font-semibold text-rj-black">{CHECKOUT_COPY.shippingSectionTitle}</p>
      <div className="flex items-center gap-3">
        <Truck className="h-4 w-4 shrink-0 text-rj-gray-500" aria-hidden="true" />
        <p className="min-w-0 text-xs text-rj-gray-600">
          <span className="font-medium text-rj-black">
            {CHECKOUT_CONSTANTS.standardDeliveryLabel}
          </span>
          {" · "}
          {CHECKOUT_CONSTANTS.standardDeliveryEstimate}
        </p>
        <span className="shrink-0 text-sm font-bold text-rj-green">
          {CHECKOUT_COPY.shippingFreeLabel}
        </span>
      </div>
    </section>
  );
}
