import { CHECKOUT_CONSTANTS } from "@/features/checkout/constants/checkout.constants";
import type { ShippingAddressInput } from "@/features/checkout/schemas/checkout.schema";
import type { Address } from "@/features/addresses/types/address.types";

/**
 * Maps a saved address onto the checkout form's shape — used both for the
 * default-address prefill (`checkout/page.tsx`) and for picking one from the
 * "Change Address" picker (`CheckoutForm`), so the mapping exists in exactly
 * one place. `streetDetails` (a single field on `addresses`) becomes `line1`;
 * `line2` has no saved-address equivalent, so it's left blank and editable.
 */
export function addressToShippingInput(address: Address): ShippingAddressInput {
  return {
    fullName: address.recipientName,
    line1: address.streetDetails,
    line2: "",
    barangay: address.barangay ?? "",
    city: address.city,
    province: address.province ?? "",
    region: address.region ?? "",
    postalCode: address.postalCode,
    country: CHECKOUT_CONSTANTS.shippingCountry,
    phone: address.phone,
  };
}
