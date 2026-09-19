import { MapPin } from "lucide-react";

import type { ShippingAddressInput } from "@/features/checkout/schemas/checkout.schema";

/** Keeps the first 5 characters visible (e.g. "+6396") and masks the rest — this is a read-only summary card, not an editable field, so the full number isn't needed at a glance. */
function maskPhone(phone: string): string {
  const visible = phone.slice(0, 5);
  return visible + "•".repeat(Math.max(phone.length - visible.length, 0));
}

export interface SelectedAddressCardProps {
  value: ShippingAddressInput;
}

/**
 * Compact, read-only display of the buyer's currently selected delivery
 * address — shown instead of the full manual `ShippingAddressForm` once a
 * saved address is active. Reads straight from `CheckoutForm`'s existing
 * `address` state (already populated via `addressToShippingInput`), so
 * there's no separate lookup or duplicated address-formatting logic. Renders
 * as one compact wrapped block (name/phone + full address on a line each)
 * instead of a bordered card, since it now sits inline in the parent sheet's
 * single "Delivery Address" row. "Change" (rendered by the parent) reopens
 * `AddressPicker` to pick a different one.
 */
export function SelectedAddressCard({ value }: SelectedAddressCardProps) {
  const line = [value.line1, value.barangay, value.city, value.province, value.region]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rj-gray-500" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-rj-black">
          {value.fullName}
          {value.phone ? (
            <span className="font-normal text-rj-gray-600"> &middot; {maskPhone(value.phone)}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-rj-gray-600">
          {line ? `${line}, ` : ""}
          {value.postalCode}, {value.country}
        </p>
      </div>
    </div>
  );
}
