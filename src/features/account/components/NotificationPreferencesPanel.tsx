"use client";

import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { updateBuyerPreferencesAction } from "@/features/account/actions/account.actions";
import type { BuyerPreferences } from "@/features/account/types/account.types";

type ToggleKey = "orderUpdates" | "promotions" | "pushEnabled" | "emailEnabled" | "smsEnabled";

const ROWS: { key: ToggleKey; label: string; description: string; comingSoon?: boolean }[] = [
  {
    key: "orderUpdates",
    label: "Order Updates",
    description: "Controls whether your Notifications page shows order/payment activity.",
  },
  {
    key: "promotions",
    label: "Promotions & Offers",
    description: "There's no promotional messaging on RobertJ yet.",
    comingSoon: true,
  },
  {
    key: "pushEnabled",
    label: "Push notifications",
    description: "Push delivery isn't available on this platform yet.",
    comingSoon: true,
  },
  {
    key: "emailEnabled",
    label: "Email notifications",
    description: "Email delivery isn't available on this platform yet.",
    comingSoon: true,
  },
  {
    key: "smsEnabled",
    label: "SMS notifications",
    description: "SMS delivery isn't available on this platform yet.",
    comingSoon: true,
  },
];

/**
 * `/privacy`'s Notifications section. Every toggle here is a real,
 * RLS-scoped, persisted `buyer_preferences` column — not local React state.
 * `orderUpdates` is the one wired to something real today (gates
 * `/notifications`'s activity feed); the other four have no delivery mechanism
 * behind them yet, so they're shown as disabled "Coming soon" rows rather than
 * live toggles that would imply a channel this app doesn't have.
 */
export function NotificationPreferencesPanel({
  initialPreferences,
}: {
  initialPreferences: BuyerPreferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pendingKey, setPendingKey] = useState<ToggleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: ToggleKey, value: boolean) {
    if (isPending) return;
    setError(null);
    setPendingKey(key);
    const previous = preferences;
    setPreferences((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      const result = await updateBuyerPreferencesAction({ [key]: value });
      if (!result.success) {
        setPreferences(previous);
        setError(result.error);
      }
      setPendingKey(null);
    });
  }

  return (
    <div className="flex flex-col divide-y divide-rj-gray-100">
      {ROWS.map((row) => (
        <label
          key={row.key}
          className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-rj-black">{row.label}</span>
              {row.comingSoon ? (
                <span className="rounded-full bg-rj-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rj-gray-500">
                  Coming soon
                </span>
              ) : null}
            </span>
            <span className="text-xs text-rj-gray-600">{row.description}</span>
          </span>
          <Checkbox
            checked={row.comingSoon ? false : preferences[row.key]}
            disabled={row.comingSoon || (isPending && pendingKey === row.key)}
            onChange={(event) => handleToggle(row.key, event.target.checked)}
            className="mt-0.5"
          />
        </label>
      ))}
      {error ? (
        <p className="pt-3 text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
