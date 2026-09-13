"use client";

import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { cn } from "@/lib/utils/cn";
import {
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/features/addresses/actions/address.actions";
import { AddressForm } from "@/features/addresses/components/AddressForm";
import { AddressSummary } from "@/features/addresses/components/AddressSummary";
import { addressSchema, type AddressInput } from "@/features/addresses/schemas/address.schema";
import type { Address } from "@/features/addresses/types/address.types";

type FieldErrors = Record<string, string[] | undefined>;

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

/** One saved address on `/addresses`: view, edit-in-place, delete-confirm, set-default. */
export function AddressCard({ address }: { address: Address }) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [values, setValues] = useState<AddressInput>(() => toInput(address));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isSettingDefault, startSettingDefault] = useTransition();

  function handleChange(field: keyof AddressInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleSaveEdit() {
    setFormError(null);
    const parsed = addressSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    startSaving(async () => {
      const result = await updateAddressAction(address.id, parsed.data);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setMode("view");
    });
  }

  function handleCancelEdit() {
    setValues(toInput(address));
    setFieldErrors({});
    setFormError(null);
    setMode("view");
  }

  function handleDelete() {
    startDeleting(async () => {
      await deleteAddressAction(address.id);
      // On success `revalidatePath` re-renders the list without this card;
      // on failure it simply stays in delete-confirm mode with nothing lost.
    });
  }

  function handleSetDefault() {
    startSettingDefault(async () => {
      await setDefaultAddressAction(address.id);
    });
  }

  if (mode === "edit") {
    return (
      <div className={cn(RJ_CARD, "flex flex-col gap-4 p-5")}>
        <AddressForm values={values} errors={fieldErrors} onChange={handleChange} />
        {formError ? (
          <p className="text-xs font-semibold text-danger">{formError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="rj"
            size="rjSm"
            isLoading={isSaving}
            onClick={handleSaveEdit}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="rjSm"
            disabled={isSaving}
            onClick={handleCancelEdit}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <ConfirmPanel
        label={`Delete ${address.label} address`}
        title="Delete this address?"
        description="This can't be undone."
        tone="danger"
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setMode("view")}
      />
    );
  }

  return (
    <div
      className={cn(
        RJ_CARD,
        "flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between",
      )}
    >
      <AddressSummary address={address} />
      <div className="flex flex-wrap gap-2">
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
        <Button type="button" variant="ghost" size="rjSm" onClick={() => setMode("edit")}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="rjSm"
          className="text-rj-red-dark"
          onClick={() => setMode("delete")}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
