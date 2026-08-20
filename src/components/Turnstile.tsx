"use client";

import Script from "next/script";
import { useEffect, useId, useState } from "react";

import { publicEnv } from "@/config/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  /** Called with the verification token, or "" when it expires/errors. */
  onVerify: (token: string) => void;
}

/**
 * Cloudflare Turnstile widget for Supabase Auth's `captchaToken` option.
 * Loaded via a plain <script> tag (no new npm dependency) rather than a
 * React wrapper package. Remount with a new `key` after each submit attempt
 * to get a fresh token — Turnstile tokens are single-use.
 */
export function Turnstile({ onVerify }: TurnstileProps) {
  const containerId = `turnstile-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !window.turnstile) return;

    const widgetId = window.turnstile.render(`#${containerId}`, {
      sitekey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      callback: onVerify,
      "expired-callback": () => onVerify(""),
      "error-callback": () => onVerify(""),
    });

    return () => window.turnstile?.remove(widgetId);
    // onVerify is expected to be a stable setState function from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, containerId]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div id={containerId} />
    </>
  );
}
