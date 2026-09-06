"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createXenditCardSessionAction } from "@/features/payments/actions/xendit.actions";

type Phase = "idle" | "loading" | "ready" | "submitting" | "complete" | "expired" | "error";

/**
 * Card payment via a Xendit Payment Session (mode=COMPONENTS). Raw card data
 * never reaches our server — the `xendit-components-web` widget collects and
 * tokenizes it directly against Xendit using a short-lived, session-scoped
 * `components_sdk_key` minted server-side. Completion here ("session-complete")
 * is informational only; the webhook is what actually confirms payment.
 */
export function XenditCardPaymentButton({ orderId }: { orderId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const componentsRef = useRef<import("xendit-components-web").XenditComponents | null>(null);

  useEffect(() => {
    return () => {
      componentsRef.current = null;
    };
  }, []);

  async function startCardPayment() {
    setError(null);
    setPhase("loading");

    const result = await createXenditCardSessionAction(orderId);
    if (!result.success) {
      setError(result.error);
      setPhase("error");
      return;
    }

    try {
      const { XenditComponents } = await import("xendit-components-web");
      const components = new XenditComponents({
        componentsSdkKey: result.data.componentsSdkKey,
      });
      componentsRef.current = components;

      components.addEventListener("init", () => {
        const channel = components.getActiveChannels({ filter: "CARDS" })[0];
        if (!channel || !containerRef.current) {
          setError("Card payment is not available for this order right now.");
          setPhase("error");
          return;
        }
        const element = components.createChannelComponent(channel);
        containerRef.current.replaceChildren(element);
        setPhase("ready");
      });

      components.addEventListener("session-complete", () => {
        setPhase("complete");
      });
      components.addEventListener("session-expired-or-canceled", () => {
        setPhase("expired");
      });
    } catch {
      setError("Could not load the card payment form. Please try again.");
      setPhase("error");
    }
  }

  function handleSubmit() {
    setPhase("submitting");
    componentsRef.current?.submit();
  }

  if (phase === "complete") {
    return (
      <p className="text-sm font-medium text-rj-black">
        Payment submitted — confirming with Xendit. This page will update once confirmed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {phase === "idle" || phase === "error" ? (
        <Button type="button" variant="rjOutline" size="rj" onClick={startCardPayment}>
          Pay with Card
        </Button>
      ) : null}
      {phase === "loading" ? <p className="text-xs text-rj-gray-600">Loading card form…</p> : null}
      <div ref={containerRef} />
      {phase === "ready" || phase === "submitting" ? (
        <Button
          type="button"
          variant="rj"
          size="rj"
          isLoading={phase === "submitting"}
          onClick={handleSubmit}
        >
          Pay now
        </Button>
      ) : null}
      {phase === "expired" ? (
        <p className="text-xs text-rj-red-dark">
          This payment session expired or was cancelled. Try again below.
        </p>
      ) : null}
      {error ? <p className="text-xs text-rj-red-dark">{error}</p> : null}
    </div>
  );
}
