import type { ShippingAddress } from "@/features/orders/types/order.types";

/** Read-only delivery-address snapshot captured at checkout. */
export function ShippingAddressCard({
  address,
}: {
  address: ShippingAddress | null;
}) {
  return (
    <section
      aria-label="Delivery address"
      className="rounded-2xl border border-rj-gray-100 bg-rj-white p-5"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Delivery address
      </h2>
      {address ? (
        <address className="mt-3 flex flex-col gap-0.5 text-sm not-italic text-rj-black">
          <span className="font-semibold">{address.fullName}</span>
          <span>{address.line1}</span>
          {address.line2 ? <span>{address.line2}</span> : null}
          <span>{[address.city, address.postalCode].filter(Boolean).join(", ")}</span>
          <span>{address.country}</span>
          {address.phone ? (
            <span className="mt-1 text-xs text-rj-gray-600">{address.phone}</span>
          ) : null}
        </address>
      ) : (
        <p className="mt-3 text-sm text-rj-gray-600">
          No delivery address was recorded for this order.
        </p>
      )}
    </section>
  );
}
