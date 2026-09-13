import type { Metadata } from "next";

import { AddressList } from "@/features/addresses/components/AddressList";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { listMyAddresses, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "My Addresses" };

export default async function AddressesPage() {
  const user = await requireSessionUser();
  const addresses = await listMyAddresses(user.id);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title="Addresses"
        description="Manage the delivery addresses saved to your account."
      />
      <div className="max-w-xl">
        <AddressList addresses={addresses} />
      </div>
    </div>
  );
}
