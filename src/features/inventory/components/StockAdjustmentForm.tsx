"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { adjustStockAction } from "@/features/inventory/actions/inventory.actions";
import {
  MANUAL_STOCK_ADJUSTMENT_REASONS,
  STOCK_ADJUSTMENT_REASON_LABELS,
} from "@/features/inventory/constants/inventory.constants";
import type { InventoryItem } from "@/features/inventory/types/inventory.types";
import type { ActionResult } from "@/types/action.types";

const selectClasses =
  "h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const textareaClasses =
  "min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export interface StockAdjustmentFormProps {
  item: InventoryItem;
  onDone?: () => void;
}

/** Inline form for a manual stock change: +/- delta, a reason, and an optional note. */
export function StockAdjustmentForm({ item, onDone }: StockAdjustmentFormProps) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<InventoryItem> | null,
    FormData
  >(adjustStockAction, null);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  useEffect(() => {
    if (state?.success) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-3">
      {formError ? <ErrorState title="Couldn't adjust stock" message={formError} /> : null}

      <input type="hidden" name="productId" value={item.productId} />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          name="delta"
          label="Adjustment"
          type="number"
          step="1"
          hint="Positive to add stock, negative to remove."
          errors={fieldErrors?.delta}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="adjustment-reason" className="text-sm font-medium">
            Reason
          </label>
          <select id="adjustment-reason" name="reason" className={selectClasses} required>
            {MANUAL_STOCK_ADJUSTMENT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {STOCK_ADJUSTMENT_REASON_LABELS[reason]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="adjustment-note" className="text-sm font-medium">
          Note {fieldErrors?.note ? null : <span className="font-normal text-rj-gray-500">(optional)</span>}
        </label>
        <textarea
          id="adjustment-note"
          name="note"
          placeholder="e.g. Damaged in storage"
          className={textareaClasses}
        />
        {fieldErrors?.note ? (
          <p className="text-xs text-danger" role="alert">
            {fieldErrors.note[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="rj" size="rjSm" isLoading={isPending} className="w-full sm:w-auto">
        {isPending ? "Saving…" : "Apply adjustment"}
      </Button>
    </form>
  );
}
