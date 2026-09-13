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
        title="My Addresses"
        description="Manage the delivery addresses saved to your account."
      />
      <div className="max-w-2xl rounded-2xl border border-rj-gray-100 bg-rj-white p-6 sm:p-8">
        <AddressList addresses={addresses} />
      </div>
    </div>
  );
}
