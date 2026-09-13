"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { createAddressAction } from "@/features/addresses/actions/address.actions";
import { AddressCard } from "@/features/addresses/components/AddressCard";
import { AddressModal } from "@/features/addresses/components/AddressModal";
import type { AddressInput } from "@/features/addresses/schemas/address.schema";
import type { Address } from "@/features/addresses/types/address.types";

// `label` is still a required field on `addressSchema`, but the modal no
// longer has a picker for it (removed along with the Home/Work toggle) — a
// new address just defaults to "Home".
const EMPTY_INPUT: AddressInput = {
  label: "Home",
  recipientName: "",
  phone: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  streetDetails: "",
  postalCode: "",
};

/**
 * The `/addresses` management section: a top toolbar ("Address" label + "+
 * Add Address", Shopee-style — top-right, not buried at the bottom of the
 * list), the saved addresses as compact divided rows, and a centered
 * add-address modal (`AddressModal`, shared with `AddressCard`'s Edit).
 */
export function AddressList({ addresses }: { addresses: Address[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-500">
          Address
        </p>
        <Button type="button" variant="rj" size="rjSm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          title="No saved addresses yet"
          description="Add an address to speed up checkout next time."
        />
      ) : (
        <div className="flex flex-col">
          {addresses.map((address, index) => (
            <AddressCard
              key={address.id}
              address={address}
              isLast={index === addresses.length - 1}
            />
          ))}
        </div>
      )}

      {isAddOpen ? (
        <AddressModal
          title="New Address"
          initialValues={EMPTY_INPUT}
          onCancel={() => setIsAddOpen(false)}
          onSubmit={async (input) => {
            const result = await createAddressAction(input);
            if (result.success) setIsAddOpen(false);
            return result;
          }}
        />
      ) : null}
    </div>
  );
}
