"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { isStripeConfigured, publicEnv } from "@/config/env";
import { ROUTES } from "@/constants/routes";
import { createCheckoutIntentAction } from "@/features/checkout/actions/stripe.actions";
import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import type { PlacedOrder } from "@/features/checkout/types/checkout.types";
import { formatCurrency } from "@/lib/utils/currency";

// Stripe is an experimental spike (see DECISIONS.md -> ADR-014), not the
// official payment path — the publishable key may be absent. `null` here
// leaves Elements uninitialized; the component guards on isStripeConfigured
// before ever reaching it.
const stripePromise = publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

/**
 * Stripe card payment for the placed orders, paid one order at a time. Each
 * order gets its own Payment Intent (created server-side from the DB amount);
 * payment_status stays 'pending' until the Module-7 webhook confirms it.
 */
export function StripePaymentFlow({
  orders,
  onComplete,
}: {
  orders: PlacedOrder[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const order = orders[index];

  if (!isStripeConfigured) {
    // Defensive fallback: PaymentMethodCard already hides "Card" when Stripe
    // isn't configured, so this should be unreachable in normal use.
    return (
      <ErrorState
        title="Card payments unavailable"
        message="Card payments aren't configured for this deployment. Please choose Cash on Delivery instead."
      />
    );
  }

  function handlePaid() {
    if (index + 1 < orders.length) setIndex(index + 1);
    else onComplete();
  }

  return (
    <section aria-label="Card payment" className="flex flex-col gap-4">
      {orders.length > 1 ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
          Order {index + 1} of {orders.length}
        </p>
      ) : null}
      <SingleOrderPayment
        key={order.orderId}
        orderId={order.orderId}
        orderNumber={order.orderNumber}
        onPaid={handlePaid}
      />
    </section>
  );
}

/** One order's Stripe payment. Keyed by order id so state resets per order. */
function SingleOrderPayment({
  orderId,
  orderNumber,
  onPaid,
}: {
  orderId: string;
  orderNumber: string;
  onPaid: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentInfo, setIntentInfo] = useState<{
    amountCents: number;
    currency: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createCheckoutIntentAction({ orderId }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setClientSecret(result.data.clientSecret);
        setIntentInfo({
          amountCents: result.data.amountCents,
          currency: result.data.currency,
        });
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) {
    return <ErrorState title="Couldn't start payment" message={error} />;
  }

  if (!clientSecret || !intentInfo) {
    return <LoadingState rows={2} label="Preparing payment" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-rj-black">
        {orderNumber} · {formatCurrency(intentInfo.amountCents, intentInfo.currency)}
      </p>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CardPaymentForm clientSecret={clientSecret} onPaid={onPaid} />
      </Elements>
    </div>
  );
}

function CardPaymentForm({
  clientSecret,
  onPaid,
}: {
  clientSecret: string;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.orders}`,
      },
      redirect: "if_required",
    });

    setSubmitting(false);

    const status = result.paymentIntent?.status;
    const redirectUrl =
      result.paymentIntent?.next_action?.redirect_to_url?.url ?? null;

    // Redirect-required methods (wallets, BNPL) carry a hosted redirect even
    // when confirmPayment resolves without an error. Follow it so the payment
    // can complete — never report a redirect as a failure (audit H3).
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    if (result.error) {
      setError(result.error.message ?? "Payment failed. Please try again.");
      return;
    }

    if (status === "succeeded") {
      onPaid();
      return;
    }

    // Async bank methods and unresolved challenges return 'processing' /
    // 'requires_action'. The Module-7 webhook confirms the outcome later — this
    // is not a failure and must not be reported as one.
    if (status === "processing" || status === "requires_action") {
      setError(CHECKOUT_COPY.paymentPending);
      return;
    }

    setError(
      "Your payment wasn't completed. Please try again or choose Cash on Delivery.",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5">
        <PaymentElement />
      </div>
      {error ? <ErrorState title="Payment failed" message={error} /> : null}
      <Button
        type="button"
        variant="rj"
        size="rj"
        isLoading={submitting}
        disabled={!stripe || !elements}
        onClick={handlePay}
        className="w-full"
      >
        {submitting ? CHECKOUT_COPY.processingPayment : CHECKOUT_COPY.payNow}
      </Button>
    </div>
  );
}
