import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import type { PaymentMethod } from "@/features/checkout/types/checkout.types";
import { cn } from "@/lib/utils/cn";

// The Stripe/card spike (ADR-014) has been retired — COD and QR (ADR-008's
// target methods) are the only two options.
const METHODS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  { value: "cod", label: CHECKOUT_COPY.codLabel, description: CHECKOUT_COPY.codDescription },
  { value: "qr_upload", label: CHECKOUT_COPY.qrLabel, description: CHECKOUT_COPY.qrDescription },
];

/**
 * Payment-method selector (COD | QR Transfer). Selecting QR is informational
 * only here — nothing is persisted at order-placement time; the buyer
 * actually submits a receipt afterward from the order detail page (see
 * `features/payments`).
 */
export function PaymentMethodCard({
  method,
  onChange,
}: {
  method: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5">
      <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        {CHECKOUT_COPY.paymentSectionTitle}
      </legend>
      <div className="mt-3 flex flex-col gap-3">
        {METHODS.map((option) => {
          const selected = method === option.value;
          return (
            <label
              key={option.value}
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
          );
        })}
      </div>
    </fieldset>
  );
}
