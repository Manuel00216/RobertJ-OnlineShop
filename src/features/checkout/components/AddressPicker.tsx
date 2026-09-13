import { RJ_CARD } from "@/components/ui/card";
import { AddressSummary } from "@/features/addresses/components/AddressSummary";
import type { Address } from "@/features/addresses/types/address.types";
import { cn } from "@/lib/utils/cn";

export interface AddressPickerProps {
  addresses: Address[];
  /** `null` means "+ Add New Address" is the selected option. */
  selectedAddressId: string | null;
  onSelectAddress: (address: Address) => void;
  onSelectNew: () => void;
}

/**
 * Inline (not a modal) "Change Address" picker — radio-style selection among
 * the buyer's saved addresses, reusing `AddressSummary` (the same display
 * logic `/addresses` uses) rather than re-formatting addresses here. The
 * trailing "+ Add New Address" option hands off to the existing, always-
 * present manual `ShippingAddressForm` — there's no separate in-picker add
 * form.
 */
export function AddressPicker({
  addresses,
  selectedAddressId,
  onSelectAddress,
  onSelectNew,
}: AddressPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose a delivery address"
      className={cn(RJ_CARD, "flex flex-col divide-y divide-rj-gray-100 p-2")}
    >
      {addresses.map((address) => {
        const selected = selectedAddressId === address.id;
        return (
          <label
            key={address.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-rj-gray-50",
              selected && "bg-rj-gray-50",
            )}
          >
            <input
              type="radio"
              name="saved-address"
              checked={selected}
              onChange={() => onSelectAddress(address)}
              className="mt-1 h-4 w-4 shrink-0 accent-rj-red"
            />
            <AddressSummary address={address} />
          </label>
        );
      })}
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-rj-gray-50",
          selectedAddressId === null && "bg-rj-gray-50",
        )}
      >
        <input
          type="radio"
          name="saved-address"
          checked={selectedAddressId === null}
          onChange={onSelectNew}
          className="h-4 w-4 shrink-0 accent-rj-red"
        />
        <span className="text-sm font-semibold text-rj-black">+ Add New Address</span>
      </label>
    </div>
  );
}
