"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { requestReturnAction } from "@/features/returns/actions/return.actions";
import { cn } from "@/lib/utils/cn";
import type { ActionResult } from "@/types/action.types";

export interface RequestReturnPanelProps {
  orderId: string;
}

/**
 * Shown on a buyer's delivered-order detail page when no return request is
 * already open for it — mirrors `ReceiptUpload`'s form shape. A successful
 * submission revalidates the order page, which then renders
 * `ReturnRequestStatusCard` instead (server-driven by `getReturnRequestForOrder`,
 * not local state here).
 */
export function RequestReturnPanel({ orderId }: RequestReturnPanelProps) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(requestReturnAction, null);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError =
    state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <section aria-label="Request a return or refund" className={cn(RJ_CARD, "p-5")}>
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Request a Return / Refund
      </h2>
      <p className="mt-1 text-xs text-rj-gray-600">
        Tell us what went wrong. Your seller will review it first; if they
        can&apos;t resolve it, an administrator will step in.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3" aria-busy={isPending}>
        <input type="hidden" name="orderId" value={orderId} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium text-rj-black">
            Reason
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            maxLength={500}
            rows={3}
            className="rounded-md border border-rj-gray-200 bg-rj-white px-3 py-2 text-sm text-rj-black outline-none transition-colors focus-visible:border-rj-black focus-visible:ring-2 focus-visible:ring-rj-red/30"
            placeholder="e.g. Item arrived damaged, wrong size, not as described…"
          />
          {fieldErrors?.reason ? (
            <p role="alert" className="text-xs text-rj-red-dark">
              {fieldErrors.reason[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evidence" className="text-sm font-medium text-rj-black">
            Evidence photo (optional)
          </label>
          <input
            id="evidence"
            name="evidence"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-rj-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-rj-black file:px-4 file:py-2 file:text-xs file:font-bold file:text-rj-white"
          />
          {fieldErrors?.evidence ? (
            <p role="alert" className="text-xs text-rj-red-dark">
              {fieldErrors.evidence[0]}
            </p>
          ) : null}
        </div>

        {formError ? (
          <ErrorState title="Couldn't submit your request" message={formError} />
        ) : null}

        <Button
          type="submit"
          variant="rj"
          size="rjSm"
          isLoading={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </section>
  );
}
