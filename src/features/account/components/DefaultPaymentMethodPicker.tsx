"use client";

import { useState, useTransition } from "react";

import { updateBuyerPreferencesAction } from "@/features/account/actions/account.actions";
import { CHECKOUT_COPY, type PaymentMethod } from "@/features/checkout";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cod", label: CHECKOUT_COPY.codLabel },
  { value: "xendit", label: CHECKOUT_COPY.onlineLabel },
];

/**
 * `/privacy`'s Orders → Default Payment Method. Only the two methods
 * checkout actually offers (`checkout.types.ts`'s `PaymentMethod` union) —
 * never the raw DB `payment_method_type` enum, which also contains retired
 * values checkout can't select. Seeds checkout's initial radio via
 * `checkout/page.tsx` reading `getMyBuyerPreferences`; selection here has no
 * other effect (checkout's payment-method choice is itself informational —
 * see `checkout.types.ts`'s header comment).
 */
export function DefaultPaymentMethodPicker({
  initialValue,
}: {
  initialValue: PaymentMethod | null;
}) {
  const [value, setValue] = useState<PaymentMethod | null>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(method: PaymentMethod) {
    if (isPending) return;
    setError(null);
    setValue(method);
    startTransition(async () => {
      const result = await updateBuyerPreferencesAction({ defaultPaymentMethod: method });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {METHODS.map((method) => (
        <label
          key={method.value}
          className="flex items-center gap-2 text-sm text-rj-black"
        >
          <input
            type="radio"
            name="defaultPaymentMethod"
            checked={value === method.value}
            disabled={isPending}
            onChange={() => handleChange(method.value)}
            className="h-4 w-4 accent-rj-red"
          />
          {method.label}
        </label>
      ))}
      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
