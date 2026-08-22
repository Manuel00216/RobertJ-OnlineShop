import { RJ_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { CheckoutItemsList } from "@/features/checkout/components/CheckoutItemsList";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import type { CheckoutGroup } from "@/features/checkout/types/checkout.types";

/** One seller's order preview: seller label, items, and totals. */
export function CheckoutGroupCard({ group }: { group: CheckoutGroup }) {
  return (
    <section
      aria-label={`Order from ${group.sellerName ?? "this seller"}`}
      className={cn(RJ_CARD, "p-5")}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        {group.sellerName ?? "Seller"}
      </p>
      <CheckoutItemsList items={group.items} currency={group.currency} />
      <CheckoutTotals
        subtotalCents={group.subtotalCents}
        shippingFeeCents={group.shippingFeeCents}
        totalCents={group.totalCents}
        currency={group.currency}
      />
    </section>
  );
}
