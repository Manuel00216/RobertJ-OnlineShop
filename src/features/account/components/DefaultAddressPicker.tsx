"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ROUTES } from "@/constants/routes";
import { setDefaultAddressAction } from "@/features/addresses/actions/address.actions";
import type { Address } from "@/features/addresses/types/address.types";

/**
 * `/privacy`'s Orders → Default Delivery Address. Zero new backend — reuses
 * the existing `addresses` table/`setDefaultAddressAction` exactly as
 * `/addresses` does; checkout already reads `addresses.is_default` for its
 * own prefill, so picking a default here is reflected there automatically.
 */
export function DefaultAddressPicker({ addresses }: { addresses: Address[] }) {
  const defaultAddress = addresses.find((address) => address.isDefault) ?? null;
  const [selectedId, setSelectedId] = useState(defaultAddress?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (addresses.length === 0) {
    return (
      <p className="text-sm text-rj-gray-600">
        No saved addresses yet.{" "}
        <Link href={ROUTES.addresses} className="font-semibold text-rj-red-dark hover:underline">
          Add one
        </Link>{" "}
        to set a default delivery address.
      </p>
    );
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    if (isPending) return;
    const addressId = event.target.value;
    setSelectedId(addressId);
    setError(null);
    startTransition(async () => {
      const result = await setDefaultAddressAction(addressId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={selectedId}
        onChange={handleChange}
        disabled={isPending}
        className="w-full rounded-lg border border-rj-gray-200 bg-rj-white px-3 py-2 text-sm text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
      >
        {addresses.map((address) => (
          <option key={address.id} value={address.id}>
            {address.label} — {address.recipientName}, {address.city}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
