import { RJ_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { CheckoutItemsList } from "@/features/checkout/components/CheckoutItemsList";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import type { CheckoutGroup } from "@/features/checkout/types/checkout.types";

export interface CheckoutGroupCardProps {
  group: CheckoutGroup;
  /**
   * With a single seller group, this card's subtotal/shipping/total are
   * identical to the grand Order Total already shown on the right — showing
   * both is pure duplication. Defaults to `true` (useful, non-duplicate
   * per-seller breakdown) and is only turned off by the caller when there's
   * exactly one group.
   */
  showTotals?: boolean;
}

/** One seller's order preview: seller label, items, and (optionally) totals. */
export function CheckoutGroupCard({ group, showTotals = true }: CheckoutGroupCardProps) {
  return (
    <section
      aria-label={`Order from ${group.sellerName ?? "this seller"}`}
      className={cn(RJ_CARD, "p-5")}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        {group.sellerName ?? "Seller"}
      </p>
      <CheckoutItemsList items={group.items} currency={group.currency} />
      {showTotals ? (
        <CheckoutTotals
          subtotalCents={group.subtotalCents}
          shippingFeeCents={group.shippingFeeCents}
          totalCents={group.totalCents}
          currency={group.currency}
        />
      ) : null}
    </section>
  );
}
