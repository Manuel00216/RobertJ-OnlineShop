"use client";

import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { cn } from "@/lib/utils/cn";
import { createAddressAction } from "@/features/addresses/actions/address.actions";
import { AddressCard } from "@/features/addresses/components/AddressCard";
import { AddressForm } from "@/features/addresses/components/AddressForm";
import { addressSchema, type AddressInput } from "@/features/addresses/schemas/address.schema";
import type { Address } from "@/features/addresses/types/address.types";

type FieldErrors = Record<string, string[] | undefined>;

const EMPTY_INPUT: AddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  streetDetails: "",
  postalCode: "",
};

/** The `/addresses` management page: existing addresses + an "Add New Address" form. */
export function AddressList({ addresses }: { addresses: Address[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [values, setValues] = useState<AddressInput>(EMPTY_INPUT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(field: keyof AddressInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleAdd() {
    setFormError(null);
    const parsed = addressSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    startTransition(async () => {
      const result = await createAddressAction(parsed.data);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setValues(EMPTY_INPUT);
      setFieldErrors({});
      setIsAdding(false);
    });
  }

  function handleCancelAdd() {
    setValues(EMPTY_INPUT);
    setFieldErrors({});
    setFormError(null);
    setIsAdding(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 && !isAdding ? (
        <EmptyState
          title="No saved addresses yet"
          description="Add an address to speed up checkout next time."
        />
      ) : null}

      {addresses.map((address) => (
        <AddressCard key={address.id} address={address} />
      ))}

      {isAdding ? (
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
              isLoading={isPending}
              onClick={handleAdd}
            >
              Save address
            </Button>
            <Button
              type="button"
              variant="outline"
              size="rjSm"
              disabled={isPending}
              onClick={handleCancelAdd}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="rjOutline"
          size="rjSm"
          className="self-start"
          onClick={() => setIsAdding(true)}
        >
          + Add New Address
        </Button>
      )}
    </div>
  );
}
