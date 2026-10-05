"use client";

import { useRef } from "react";

const STORAGE_KEY = "roberj:checkout-idempotency";

interface StoredAttempt {
  fingerprint: string;
  key: string;
}

function isStoredAttempt(value: unknown): value is StoredAttempt {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredAttempt).fingerprint === "string" &&
    typeof (value as StoredAttempt).key === "string"
  );
}

function readStoredAttempt(): StoredAttempt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isStoredAttempt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredAttempt(attempt: StoredAttempt | null): void {
  try {
    if (attempt) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (private browsing, disabled storage) — the
    // in-memory fallback in the hook below still dedups same-mount retries.
  }
}

/**
 * Idempotency key for a checkout attempt, keyed by a content fingerprint
 * (see `buildCheckoutFingerprint`) and persisted to `sessionStorage` rather
 * than a bare `useRef` — a ref resets on remount, which silently defeats the
 * "survives a force-refresh" dedup guarantee `create_order`/`create_order_group`
 * are built for. A retry with the SAME fingerprint (double-click, lost-response
 * resubmit, even a page reload within this tab) reuses the same key so the
 * server replays the already-created order instead of duplicating it. A
 * retry with a DIFFERENT fingerprint (the buyer edited the cart/address/
 * payment choice before resubmitting) gets a fresh key, so it can never
 * replay stale, pre-edit order data.
 */
export function useCheckoutIdempotencyKey() {
  const memoryFallback = useRef<StoredAttempt | null>(null);

  function getOrCreateKey(fingerprint: string): string {
    const stored = readStoredAttempt() ?? memoryFallback.current;
    if (stored && stored.fingerprint === fingerprint) return stored.key;

    const attempt: StoredAttempt = { fingerprint, key: crypto.randomUUID() };
    memoryFallback.current = attempt;
    writeStoredAttempt(attempt);
    return attempt.key;
  }

  function retireKey(): void {
    memoryFallback.current = null;
    writeStoredAttempt(null);
  }

  return { getOrCreateKey, retireKey };
}
