"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { verifyPaymentAction } from "@/features/payments/actions/payment.actions";
import type { Payment, PaymentDecision } from "@/features/payments/types/payment.types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

export interface VerificationCardProps {
  payment: Payment;
  /** Pre-resolved signed URL (bucket is private — see `getPaymentReceiptSignedUrl`), or null if none/failed to load. */
  receiptUrl: string | null;
}

/**
 * One pending payment in the seller/admin verification queue. Verify/reject
 * each go through an inline confirm step — mirrors the focus-managed confirm
 * pattern in `CancelOrderButton` — since a decision is one-shot: the
 * `verify_payment` RPC refuses to re-decide an already-decided payment.
 */
export function VerificationCard({ payment, receiptUrl }: VerificationCardProps) {
  const [pendingDecision, setPendingDecision] = useState<PaymentDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<PaymentDecision | null>(null);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingDecision) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingDecision(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingDecision]);

  function confirmDecision() {
    if (!pendingDecision) return;
    setError(null);
    const decision = pendingDecision;
    startTransition(async () => {
      const result = await verifyPaymentAction(payment.id, decision);
      if (!result.success) {
        setError(result.error);
        setPendingDecision(null);
        return;
      }
      setDecided(decision);
      setPendingDecision(null);
    });
  }

  return (
    <div className={cn(RJ_CARD, "flex flex-col gap-4 p-5 sm:flex-row sm:items-start")}>
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        >
          {/* unoptimized: a short-lived signed Storage URL, not a stable path next/image should cache/optimize. */}
          <Image src={receiptUrl} alt="Payment receipt" fill unoptimized className="object-cover" />
        </a>
      ) : (
        <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-rj-gray-100 text-xs text-rj-gray-400">
          No receipt
        </span>
      )}

      <div className="min-w-0 flex-1">
        <Link
          href={ROUTES.orderDetail(payment.orderId)}
          className="text-sm font-bold text-rj-black hover:underline"
        >
          {payment.orderNumber}
        </Link>
        <p className="mt-0.5 text-xs text-rj-gray-600">
          {payment.buyerName ?? "Buyer"} · {formatDate(payment.createdAt)}
        </p>
        <p className="mt-1 text-sm font-semibold text-rj-black">
          {formatCurrency(payment.amountCents, payment.currency)}
        </p>

        {error ? (
          <div className="mt-2">
            <ErrorState title="Couldn't verify" message={error} />
          </div>
        ) : null}

        {decided ? (
          <p role="status" aria-live="polite" className="mt-3 text-sm font-semibold text-rj-green">
            Marked {decided === "paid" ? "verified" : "rejected"}.
          </p>
        ) : pendingDecision ? (
          <div
            ref={panelRef}
            role="alertdialog"
            aria-label={`Confirm: mark ${payment.orderNumber} as ${pendingDecision}`}
            tabIndex={-1}
            className="mt-3 rounded-xl border border-rj-gray-200 bg-rj-gray-50 p-4 outline-none"
          >
            <p className="text-sm font-semibold text-rj-black">
              {pendingDecision === "paid"
                ? "Confirm this payment was received?"
                : "Confirm this receipt should be rejected?"}
            </p>
            <p className="mt-1 text-xs text-rj-gray-600">This can&apos;t be undone.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={pendingDecision === "paid" ? "rj" : "danger"}
                size="sm"
                isLoading={isPending}
                onClick={confirmDecision}
              >
                Yes, {pendingDecision === "paid" ? "mark verified" : "reject"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setPendingDecision(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="rj"
              size="rjSm"
              onClick={() => setPendingDecision("paid")}
            >
              Mark verified
            </Button>
            <Button
              type="button"
              variant="danger"
              size="rjSm"
              onClick={() => setPendingDecision("failed")}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
