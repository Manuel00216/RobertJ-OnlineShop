"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { cn } from "@/lib/utils/cn";
import {
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/features/addresses/actions/address.actions";
import { AddressModal } from "@/features/addresses/components/AddressModal";
import type { AddressInput } from "@/features/addresses/schemas/address.schema";
import type { Address } from "@/features/addresses/types/address.types";

function toInput(address: Address): AddressInput {
  return {
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    region: address.region ?? "",
    province: address.province ?? "",
    city: address.city,
    barangay: address.barangay ?? "",
    streetDetails: address.streetDetails,
    postalCode: address.postalCode,
  };
}

export interface AddressCardProps {
  address: Address;
  /** Last row in the list gets no bottom divider. */
  isLast?: boolean;
}

/**
 * One saved address on `/addresses`: view, edit (via the shared
 * `AddressModal` — same one `AddressList`'s "+ Add Address" uses),
 * delete-confirm, set-default. Renders as a compact divided row (name +
 * phone, address underneath, Default badge, Edit/Delete + Set-as-default
 * aligned right) — not a bordered card — matching the Shopee-style address
 * list this page was reorganized around. `AddressSummary` (used by
 * checkout's `AddressPicker`) is deliberately not reused here so this stays
 * isolated to this page and never touches checkout's picker rows.
 */
export function AddressCard({ address, isLast = false }: AddressCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSettingDefault, startSettingDefault] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      await deleteAddressAction(address.id);
      // On success `revalidatePath` re-renders the list without this row;
      // on failure it simply stays in delete-confirm mode with nothing lost.
    });
  }

  function handleSetDefault() {
    startSettingDefault(async () => {
      await setDefaultAddressAction(address.id);
    });
  }

  const rowBorder = !isLast && "border-b border-rj-gray-100";

  if (confirmingDelete) {
    return (
      <div className={cn("py-5", rowBorder)}>
        <ConfirmPanel
          label={`Delete ${address.label} address`}
          title="Delete this address?"
          description="This can't be undone."
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          isPending={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      </div>
    );
  }

  // Same combined-field convention as AddressSummary, split across two lines
  // for scanability instead of one long run-on line.
  const addressLine2 = [address.barangay, address.city, address.province, address.region]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4", rowBorder)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-rj-gray-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rj-gray-600">
            {address.label}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-rj-black">{address.recipientName}</span>
          <span className="text-rj-gray-300" aria-hidden="true">
            |
          </span>
          <span className="text-sm text-rj-gray-600">{address.phone}</span>
        </div>
        <p className="mt-1 text-xs text-rj-gray-600">{address.streetDetails}</p>
        {addressLine2 ? (
          <p className="text-xs text-rj-gray-600">
            {addressLine2}, {address.postalCode}, {address.country}
          </p>
        ) : (
          <p className="text-xs text-rj-gray-600">
            {address.postalCode}, {address.country}
          </p>
        )}
        {address.isDefault ? (
          <span className="mt-2 inline-flex w-fit items-center rounded border border-rj-red-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rj-red-dark">
            Default
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
          >
            Delete
          </button>
        </div>
        {!address.isDefault ? (
          <Button
            type="button"
            variant="outline"
            size="rjSm"
            isLoading={isSettingDefault}
            onClick={handleSetDefault}
          >
            Set as default
          </Button>
        ) : null}
      </div>

      {isEditOpen ? (
        <AddressModal
          title="Edit Address"
          initialValues={toInput(address)}
          isAlreadyDefault={address.isDefault}
          onCancel={() => setIsEditOpen(false)}
          onSubmit={async (input) => {
            const result = await updateAddressAction(address.id, input);
            if (result.success) setIsEditOpen(false);
            return result;
          }}
        />
      ) : null}
    </div>
  );
}
