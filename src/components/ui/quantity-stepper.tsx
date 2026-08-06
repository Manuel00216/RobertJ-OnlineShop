import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export interface QuantityStepperProps {
  value: number;
  /** @default 1 */
  min?: number;
  /** Stock ceiling — callers always have one. */
  max: number;
  onChange: (next: number) => void;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** Clamped +/- stepper with a manually-editable numeric input. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  id,
  "aria-label": ariaLabel,
  className,
}: QuantityStepperProps) {
  const clamp = (next: number) => Math.max(min, Math.min(next, max));

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rj-gray-200 text-rj-black transition-colors hover:border-rj-black disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <label htmlFor={id} className="sr-only">
        {ariaLabel ?? "Quantity"}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={id ? undefined : ariaLabel}
        className="h-11 w-14 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-2 text-center text-sm text-rj-black outline-none transition-colors focus-visible:border-rj-black"
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rj-gray-200 text-rj-black transition-colors hover:border-rj-black disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
