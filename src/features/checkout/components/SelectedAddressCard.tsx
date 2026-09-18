import { RJ_CARD } from "@/components/ui/card";
import type { ShippingAddressInput } from "@/features/checkout/schemas/checkout.schema";
import { cn } from "@/lib/utils/cn";

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
 * there's no separate lookup or duplicated address-formatting logic. "Change"
 * (rendered by the parent) reopens `AddressPicker` to pick a different one.
 */
export function SelectedAddressCard({ value }: SelectedAddressCardProps) {
  const line = [value.line1, value.barangay, value.city, value.province, value.region]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn(RJ_CARD, "flex flex-col gap-1 p-4")}>
      <p className="text-sm font-semibold text-rj-black">{value.fullName}</p>
      {line ? <p className="text-sm text-rj-gray-600">{line}</p> : null}
      <p className="text-sm text-rj-gray-600">
        {value.postalCode}, {value.country}
      </p>
      {value.phone ? (
        <p className="text-sm text-rj-gray-600">{maskPhone(value.phone)}</p>
      ) : null}
    </div>
  );
}
