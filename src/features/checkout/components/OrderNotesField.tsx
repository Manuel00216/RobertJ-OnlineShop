import { useId } from "react";

import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import { cn } from "@/lib/utils/cn";

export interface OrderNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
}

/**
 * Optional free-text message to the seller(s), applied to every order this
 * checkout creates. `FormField` (`src/components/forms`) only wraps `<input>`
 * elements, so this is its own small section rather than forcing a textarea
 * through that component — same visual language (label, hint, error) as the
 * rest of checkout. Renders as a plain label+textarea block, not its own
 * bordered card, since it now sits inside the parent sheet's divider list.
 */
export function OrderNotesField({ value, onChange, errors }: OrderNotesFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <section aria-label={CHECKOUT_COPY.notesSectionTitle}>
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600"
      >
        {CHECKOUT_COPY.notesSectionTitle}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={CHECKOUT_COPY.notesPlaceholder}
        maxLength={500}
        rows={3}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "mt-3 w-full resize-none rounded-xl border border-rj-gray-200 bg-rj-white p-3 text-sm text-rj-black outline-none transition-colors placeholder:text-rj-gray-400 focus-visible:border-rj-black focus-visible:ring-2 focus-visible:ring-rj-red/30",
          hasError && "border-danger focus-visible:ring-danger",
        )}
      />
      {hasError ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {errors?.[0]}
        </p>
      ) : null}
    </section>
  );
}
