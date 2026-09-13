import { Badge } from "@/components/ui/badge";
import type { Address } from "@/features/addresses/types/address.types";

/**
 * Shared read-only address display — both the `/addresses` management
 * page's `AddressCard` and checkout's inline picker render the same fact
 * pattern, so the formatting logic lives here once.
 */
export function AddressSummary({ address }: { address: Address }) {
  const line = [
    address.streetDetails,
    address.barangay,
    address.city,
    address.province,
    address.region,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-rj-gray-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rj-gray-600">
          {address.label}
        </span>
        {address.isDefault ? <Badge tone="success">Default</Badge> : null}
      </div>
      <p className="text-sm font-semibold text-rj-black">
        {address.recipientName}{" "}
        <span className="font-normal text-rj-gray-600">· {address.phone}</span>
      </p>
      <p className="text-xs text-rj-gray-600">
        {line ? `${line}, ` : ""}
        {address.postalCode}, {address.country}
      </p>
    </div>
  );
}
