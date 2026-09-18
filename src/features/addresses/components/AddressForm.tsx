"use client";

import { FormField } from "@/components/forms/FormField";
import type { AddressInput } from "@/features/addresses/schemas/address.schema";

export interface AddressFormProps {
  values: AddressInput;
  errors?: Record<string, string[] | undefined>;
  onChange: (field: keyof AddressInput, value: string) => void;
}

/**
 * The add/edit address fields, used only within this feature (`AddressModal`
 * — shared by both the "+ Add Address" and "Edit" flows on `/addresses`).
 * `label` is no longer editable here (no Home/Work picker) — a new address
 * defaults to "Home" (see `AddressList`'s `EMPTY_INPUT`), and editing an
 * existing address keeps whatever label it already had, unchanged.
 */
export function AddressForm({ values, errors, onChange }: AddressFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Full Name"
          tone="brand"
          value={values.recipientName}
          onChange={(event) => onChange("recipientName", event.target.value)}
          autoComplete="name"
          errors={errors?.recipientName}
        />
        <FormField
          label="Phone Number"
          type="tel"
          tone="brand"
          value={values.phone}
          onChange={(event) => onChange("phone", event.target.value)}
          placeholder="+63 912 345 6789"
          autoComplete="tel"
          errors={errors?.phone}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Region (optional)"
          tone="brand"
          value={values.region}
          onChange={(event) => onChange("region", event.target.value)}
          errors={errors?.region}
        />
        <FormField
          label="Province (optional)"
          tone="brand"
          value={values.province}
          onChange={(event) => onChange("province", event.target.value)}
          autoComplete="address-level1"
          errors={errors?.province}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="City / Municipality"
          tone="brand"
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
          autoComplete="address-level2"
          errors={errors?.city}
        />
        <FormField
          label="Barangay (optional)"
          tone="brand"
          value={values.barangay}
          onChange={(event) => onChange("barangay", event.target.value)}
          errors={errors?.barangay}
        />
      </div>
      <FormField
        label="Postal Code"
        tone="brand"
        value={values.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value)}
        autoComplete="postal-code"
        errors={errors?.postalCode}
      />
      <FormField
        label="Street Name / Building / House No."
        tone="brand"
        value={values.streetDetails}
        onChange={(event) => onChange("streetDetails", event.target.value)}
        placeholder="House number, street, landmark"
        autoComplete="address-line1"
        errors={errors?.streetDetails}
      />
    </div>
  );
}
