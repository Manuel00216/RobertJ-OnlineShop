import type { Metadata } from "next";

import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { CheckoutForm } from "@/features/checkout/components/CheckoutForm";
import { CHECKOUT_CONSTANTS } from "@/features/checkout/constants/checkout.constants";
import type { ShippingAddressInput } from "@/features/checkout/schemas/checkout.schema";
import { addressToShippingInput } from "@/features/checkout/utils/addressMapping";
import * as queries from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await queries.requireSessionUser();

  // Prefill priority: default saved address -> last order's address ->
  // profile name/phone -> empty form. Each fetch degrades independently
  // (`.catch(() => ...)`) so one failing never blocks checkout.
  const [savedAddresses, lastOrders, profile] = await Promise.all([
    queries.listMyAddresses(user.id).catch(() => []),
    queries.listBuyerOrders(user.id, { page: 1, pageSize: 1 }).catch(() => null),
    queries.getMyProfile().catch(() => null),
  ]);

  const defaultAddress = savedAddresses.find((address) => address.isDefault) ?? null;
  const lastAddress = lastOrders?.items[0]?.shippingAddress ?? null;

  let initialAddress: ShippingAddressInput | undefined;
  let initialAddressSource: "saved" | "last-order" | "profile" | "empty";
  let initialSelectedAddressId: string | null = null;

  if (defaultAddress) {
    initialAddress = addressToShippingInput(defaultAddress);
    initialAddressSource = "saved";
    initialSelectedAddressId = defaultAddress.id;
  } else if (lastAddress) {
    initialAddress = {
      fullName: lastAddress.fullName,
      line1: lastAddress.line1,
      line2: lastAddress.line2 ?? "",
      barangay: lastAddress.barangay ?? "",
      city: lastAddress.city,
      province: lastAddress.province ?? "",
      region: lastAddress.region ?? "",
      postalCode: lastAddress.postalCode,
      country: CHECKOUT_CONSTANTS.shippingCountry,
      phone: lastAddress.phone ?? "",
    };
    initialAddressSource = "last-order";
  } else if (profile?.fullName || profile?.phone) {
    initialAddress = {
      fullName: profile.fullName ?? "",
      line1: "",
      line2: "",
      barangay: "",
      city: "",
      province: "",
      region: "",
      postalCode: "",
      country: CHECKOUT_CONSTANTS.shippingCountry,
      phone: profile.phone ?? "",
    };
    initialAddressSource = "profile";
  } else {
    initialAddressSource = "empty";
  }

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Checkout"
        title="Checkout"
        description="Review your order, add a delivery address, and place your order."
      />
      <CheckoutForm
        savedAddresses={savedAddresses}
        initialAddress={initialAddress}
        initialAddressSource={initialAddressSource}
        initialSelectedAddressId={initialSelectedAddressId}
      />
    </div>
  );
}
