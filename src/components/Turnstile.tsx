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
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (scriptLoaded) return;
    // If the script never loads (ad-blocker, corporate proxy, regional
    // restriction) the widget never mounts and submit stays silently
    // disabled forever, since captchaToken can never be set. Surface it.
    const timeout = setTimeout(() => setLoadFailed(true), 8000);
    return () => clearTimeout(timeout);
  }, [scriptLoaded]);

  // On a forced remount (new `key` after a submit attempt, so the widget
  // gets a fresh single-use token) the Cloudflare script is almost always
  // already loaded process-wide — next/script only invokes `onLoad` the
  // first time a given `src` loads, so a later remount's own onLoad would
  // never fire and scriptLoaded would stay stuck false forever. Check
  // directly on mount instead of waiting on a callback that won't come.
  useEffect(() => {
    // Syncing from an external system (the script tag's load state, which
    // may already be true before this effect ever runs) — the same
    // sanctioned exception used elsewhere in this file/feature for Turnstile
    // state resets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.turnstile) setScriptLoaded(true);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !window.turnstile) return;

    const widgetId = window.turnstile.render(`#${containerId}`, {
      sitekey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      // "flexible" fills the container's width instead of Cloudflare's fixed
      // 300px default, which overflows the auth card on narrow phones.
      size: "flexible",
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
      {/* min-height reserves space so the form doesn't jump once the widget mounts */}
      <div id={containerId} className="w-full" style={{ minHeight: 65 }} />
      {/* Gated on `!scriptLoaded`, not just `loadFailed`: the 8s timeout can
          fire and set loadFailed on a slow connection, then the script loads
          moments later anyway — nothing else would otherwise clear this
          stale `true` and the banner would claim the form is broken forever
          even after the widget mounts and works. */}
      {loadFailed && !scriptLoaded ? (
        <p role="alert" className="mt-1.5 text-xs text-rj-red-dark">
          Verification didn&apos;t load. Please refresh the page or try a different network.
        </p>
      ) : null}
    </>
  );
}
