"use client";

import Image from "next/image";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { submitQrPaymentAction } from "@/features/payments/actions/payment.actions";
import type { ActionResult } from "@/types/action.types";

export interface ReceiptUploadProps {
  orderId: string;
  sellerName: string | null;
  sellerPaymentQrUrl: string | null;
}

/**
 * Shown on a buyer's order detail page when the order is pending payment and
 * no receipt has been submitted yet. Displays the seller's receiving QR code
 * (if they've set one) so the buyer actually knows where to send money.
 */
export function ReceiptUpload({
  orderId,
  sellerName,
  sellerPaymentQrUrl,
}: ReceiptUploadProps) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(submitQrPaymentAction, null);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError =
    state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <section
      aria-label="Pay via QR transfer (optional)"
      className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Paying via QR transfer? (optional)
      </h2>
      <p className="mt-1 text-xs text-rj-gray-600">
        Paying Cash on Delivery instead? No action needed — pay when your
        order arrives.
      </p>

      {sellerPaymentQrUrl ? (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="text-xs text-rj-gray-600">
            Scan {sellerName ?? "the seller"}&apos;s QR code to send payment,
            then upload your receipt below.
          </p>
          {/* unoptimized: seller-pasted URL, not restricted to the Supabase
              Storage host next.config.ts's remotePatterns allowlists. */}
          <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-rj-gray-100 bg-rj-gray-50">
            <Image
              src={sellerPaymentQrUrl}
              alt={`${sellerName ?? "Seller"}'s payment QR code`}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-rj-gray-600">
          {sellerName ?? "The seller"} hasn&apos;t set up a receiving QR code
          yet — contact them for payment details before uploading a receipt.
        </p>
      )}

      <form
        action={formAction}
        className="mt-4 flex flex-col gap-3"
        aria-busy={isPending}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="receipt" className="text-sm font-medium text-rj-black">
            Receipt image
          </label>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-sm text-rj-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-rj-black file:px-4 file:py-2 file:text-xs file:font-bold file:text-rj-white"
          />
          {fieldErrors?.receipt ? (
            <p role="alert" className="text-xs text-rj-red-dark">
              {fieldErrors.receipt[0]}
            </p>
          ) : null}
        </div>

        {formError ? (
          <ErrorState title="Couldn't submit your receipt" message={formError} />
        ) : null}

        <Button
          type="submit"
          variant="rj"
          size="rjSm"
          isLoading={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Uploading…" : "Submit receipt"}
        </Button>
      </form>
    </section>
  );
}
