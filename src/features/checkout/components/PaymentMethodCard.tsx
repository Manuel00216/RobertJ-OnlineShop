import { ChevronDown } from "lucide-react";

import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import type { XenditChannel } from "@/features/checkout/schemas/checkout.schema";
import type { PaymentMethod } from "@/features/checkout/types/checkout.types";
import { cn } from "@/lib/utils/cn";

// The Stripe/card spike (ADR-014) and the QR/manual-verification flow have
// both been retired — COD and Xendit Online Payment are the only two options.
const METHODS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  { value: "cod", label: CHECKOUT_COPY.codLabel, description: CHECKOUT_COPY.codDescription },
  { value: "xendit", label: CHECKOUT_COPY.onlineLabel, description: CHECKOUT_COPY.onlineDescription },
];

const CHANNELS: Array<{ value: XenditChannel; label: string; description: string }> = [
  { value: "GCASH", label: CHECKOUT_COPY.gcashLabel, description: CHECKOUT_COPY.gcashDescription },
  { value: "PAYMAYA", label: CHECKOUT_COPY.mayaLabel, description: CHECKOUT_COPY.mayaDescription },
  { value: "CARD", label: CHECKOUT_COPY.cardLabel, description: CHECKOUT_COPY.cardDescription },
];

/**
 * Payment-method selector (COD | Online Payment), shown as a compact button
 * grid. Selecting Online Payment expands a dense GCash/Maya/Card dropdown
 * list right below it — the buyer's channel choice is made here, at
 * checkout, and carried straight into the matching Xendit action right after
 * Place Order (see `CheckoutForm`). COD never shows the dropdown and is
 * otherwise unaffected. This is a visual restyle of an already-functional
 * component — props, handlers, and validation are unchanged.
 */
export function PaymentMethodCard({
  method,
  onChange,
  channel,
  onChannelChange,
  channelError,
}: {
  method: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  channel: XenditChannel | null;
  onChannelChange: (channel: XenditChannel) => void;
  channelError?: string;
}) {
  const selectedOption = METHODS.find((option) => option.value === method);

  return (
    <fieldset>
      <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        {CHECKOUT_COPY.paymentSectionTitle}
      </legend>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {METHODS.map((option) => {
          const selected = method === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-rj-red/30",
                selected
                  ? "border-rj-red bg-rj-gray-50 text-rj-red-dark"
                  : "border-rj-gray-200 text-rj-black hover:border-rj-gray-400",
              )}
            >
              <input
                type="radio"
                name="payment-method"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{option.label}</span>
              {option.value === "xendit" ? (
                <ChevronDown
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", selected && "rotate-180")}
                  aria-hidden="true"
                />
              ) : null}
            </label>
          );
        })}
      </div>

      {selectedOption ? (
        <p className="mt-2 text-xs text-rj-gray-600">{selectedOption.description}</p>
      ) : null}

      {method === "xendit" ? (
        <fieldset className="mt-3 flex flex-col divide-y divide-rj-gray-100 rounded-xl border border-rj-gray-100">
          <legend className="sr-only">{CHECKOUT_COPY.channelSectionLabel}</legend>
          {CHANNELS.map((channelOption) => {
            const channelSelected = channel === channelOption.value;
            return (
              <label
                key={channelOption.value}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-rj-red/30",
                  channelSelected ? "bg-rj-gray-50" : "hover:bg-rj-gray-50",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-rj-black">
                    {channelOption.label}
                  </span>
                  <span className="block text-xs text-rj-gray-500">
                    {channelOption.description}
                  </span>
                </span>
                <input
                  type="radio"
                  name="payment-channel"
                  value={channelOption.value}
                  checked={channelSelected}
                  onChange={() => onChannelChange(channelOption.value)}
                  className="h-4 w-4 shrink-0 accent-rj-red"
                />
              </label>
            );
          })}
          {channelError ? (
            <p role="alert" className="px-3 py-2 text-xs font-medium text-rj-red-dark">
              {channelError}
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </fieldset>
  );
}
