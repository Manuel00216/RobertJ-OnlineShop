import { RJ_CARD } from "@/components/ui/card";
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
 * Payment-method selector (COD | Online Payment). Selecting Online Payment
 * expands an inline GCash/Maya/Card submenu — the buyer's channel choice is
 * made here, at checkout, and carried straight into the matching Xendit
 * action right after Place Order (see `CheckoutForm`). COD never shows the
 * submenu and is otherwise unaffected.
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
  return (
    <fieldset className={cn(RJ_CARD, "p-5")}>
      <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        {CHECKOUT_COPY.paymentSectionTitle}
      </legend>
      <div className="mt-3 flex flex-col gap-3">
        {METHODS.map((option) => {
          const selected = method === option.value;
          return (
            <div key={option.value}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-rj-red/30",
                  selected
                    ? "border-rj-black bg-rj-gray-50"
                    : "border-rj-gray-200 hover:border-rj-gray-400",
                )}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-rj-red"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-rj-black">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-rj-gray-600">
                    {option.description}
                  </span>
                </span>
              </label>

              {option.value === "xendit" && selected ? (
                <fieldset className="ml-4 mt-3 flex flex-col gap-2 border-l-2 border-rj-gray-100 pl-4">
                  <legend className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-600">
                    {CHECKOUT_COPY.channelSectionLabel}
                  </legend>
                  {CHANNELS.map((channelOption) => {
                    const channelSelected = channel === channelOption.value;
                    return (
                      <label
                        key={channelOption.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-rj-red/30",
                          channelSelected
                            ? "border-rj-black bg-white"
                            : "border-rj-gray-200 bg-white hover:border-rj-gray-400",
                        )}
                      >
                        <input
                          type="radio"
                          name="payment-channel"
                          value={channelOption.value}
                          checked={channelSelected}
                          onChange={() => onChannelChange(channelOption.value)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-rj-red"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-rj-black">
                            {channelOption.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-rj-gray-600">
                            {channelOption.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {channelError ? (
                    <p role="alert" className="text-xs font-medium text-rj-red-dark">
                      {channelError}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
