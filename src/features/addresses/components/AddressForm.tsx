"use client";

import { FormField } from "@/components/forms/FormField";
import type { AddressInput } from "@/features/addresses/schemas/address.schema";

export interface AddressFormProps {
  values: AddressInput;
  errors?: Record<string, string[] | undefined>;
  onChange: (field: keyof AddressInput, value: string) => void;
}

/**
 * The add/edit address fields — shared verbatim between the `/addresses`
 * management page and checkout's "+ Add New Address" flow, so address
 * field logic lives in exactly one place. Purely presentational, same
 * pattern as `ShippingAddressForm`/`OrderNotesField`.
 */
export function AddressForm({ values, errors, onChange }: AddressFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField
        label="Label"
        tone="brand"
        value={values.label}
        onChange={(event) => onChange("label", event.target.value)}
        placeholder="Home, Work, Other"
        errors={errors?.label}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Recipient name"
          tone="brand"
          value={values.recipientName}
          onChange={(event) => onChange("recipientName", event.target.value)}
          autoComplete="name"
          errors={errors?.recipientName}
        />
        <FormField
          label="Phone"
          type="tel"
          tone="brand"
          value={values.phone}
          onChange={(event) => onChange("phone", event.target.value)}
          placeholder="+63 912 345 6789"
          autoComplete="tel"
          errors={errors?.phone}
        />
      </div>
      <FormField
        label="Street / House / Unit"
        tone="brand"
        value={values.streetDetails}
        onChange={(event) => onChange("streetDetails", event.target.value)}
        placeholder="House number, street, landmark"
        autoComplete="address-line1"
        errors={errors?.streetDetails}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Barangay (optional)"
          tone="brand"
          value={values.barangay}
          onChange={(event) => onChange("barangay", event.target.value)}
          errors={errors?.barangay}
        />
        <FormField
          label="City / Municipality"
          tone="brand"
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
          autoComplete="address-level2"
          errors={errors?.city}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Province (optional)"
          tone="brand"
          value={values.province}
          onChange={(event) => onChange("province", event.target.value)}
          autoComplete="address-level1"
          errors={errors?.province}
        />
        <FormField
          label="Region (optional)"
          tone="brand"
          value={values.region}
          onChange={(event) => onChange("region", event.target.value)}
          errors={errors?.region}
        />
      </div>
      <FormField
        label="Postal code"
        tone="brand"
        value={values.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value)}
        autoComplete="postal-code"
        errors={errors?.postalCode}
      />
    </div>
  );
}
