import { FormField } from "@/components/forms/FormField";
import type { ShippingAddressInput } from "@/features/checkout/schemas/checkout.schema";

/**
 * Controlled shipping-address fields on `FormField tone="brand"`. The client
 * `CheckoutForm` owns the state + client-side validation; this stays a simple
 * presentational component.
 */
export function ShippingAddressForm({
  values,
  errors,
  onChange,
}: {
  values: ShippingAddressInput;
  errors?: Record<string, string[] | undefined>;
  onChange: (field: keyof ShippingAddressInput, value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border border-rj-gray-100 bg-rj-white p-5">
      <legend className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Shipping address
      </legend>

      <FormField
        name="fullName"
        label="Full name"
        tone="brand"
        value={values.fullName}
        onChange={(event) => onChange("fullName", event.target.value)}
        placeholder="Full name"
        autoComplete="name"
        errors={errors?.fullName}
      />
      <FormField
        name="line1"
        label="Street address"
        tone="brand"
        value={values.line1}
        onChange={(event) => onChange("line1", event.target.value)}
        placeholder="House number and street"
        autoComplete="address-line1"
        errors={errors?.line1}
      />
      <FormField
        name="line2"
        label="Apartment, suite, etc. (optional)"
        tone="brand"
        value={values.line2}
        onChange={(event) => onChange("line2", event.target.value)}
        placeholder="Apartment, floor, landmark…"
        autoComplete="address-line2"
        errors={errors?.line2}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="city"
          label="City"
          tone="brand"
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
          placeholder="City"
          autoComplete="address-level2"
          errors={errors?.city}
        />
        <FormField
          name="postalCode"
          label="Postal code"
          tone="brand"
          value={values.postalCode}
          onChange={(event) => onChange("postalCode", event.target.value)}
          placeholder="Postal code"
          autoComplete="postal-code"
          errors={errors?.postalCode}
        />
      </div>
      <FormField
        name="country"
        label="Country"
        tone="brand"
        value={values.country}
        onChange={(event) => onChange("country", event.target.value)}
        placeholder="Country"
        autoComplete="country-name"
        errors={errors?.country}
      />
      <FormField
        name="phone"
        label="Phone (optional)"
        type="tel"
        tone="brand"
        value={values.phone}
        onChange={(event) => onChange("phone", event.target.value)}
        placeholder="+63 912 345 6789"
        autoComplete="tel"
        errors={errors?.phone}
      />
    </fieldset>
  );
}
