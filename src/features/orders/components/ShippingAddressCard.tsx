import { RJ_CARD, THEMED_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { ShippingAddress } from "@/features/orders/types/order.types";

/** Read-only delivery-address snapshot captured at checkout. `themed`: see OrderHeader. */
export function ShippingAddressCard({
  address,
  themed = false,
}: {
  address: ShippingAddress | null;
  themed?: boolean;
}) {
  const ink = themed ? "text-foreground" : "text-rj-black";
  const muted = themed ? "text-muted-foreground" : "text-rj-gray-600";
  return (
    <section aria-label="Delivery address" className={cn(themed ? THEMED_CARD : RJ_CARD, "p-5")}>
      <h2 className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", muted)}>
        Delivery address
      </h2>
      {address ? (
        <address className={cn("mt-3 flex flex-col gap-0.5 text-sm not-italic", ink)}>
          <span className="font-semibold">{address.fullName}</span>
          <span>{address.line1}</span>
          {address.line2 ? <span>{address.line2}</span> : null}
          <span>
            {[address.barangay, address.city, address.province, address.region]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span>{[address.postalCode, address.country].filter(Boolean).join(", ")}</span>
          {address.phone ? <span className={cn("mt-1 text-xs", muted)}>{address.phone}</span> : null}
        </address>
      ) : (
        <p className={cn("mt-3 text-sm", muted)}>
          No delivery address was recorded for this order.
        </p>
      )}
    </section>
  );
}
