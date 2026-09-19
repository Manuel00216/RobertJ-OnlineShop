import { CheckoutItemsList } from "@/features/checkout/components/CheckoutItemsList";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import type { CheckoutGroup } from "@/features/checkout/types/checkout.types";

export interface CheckoutGroupCardProps {
  group: CheckoutGroup;
  /**
   * With a single seller group, this card's subtotal/shipping/total are
   * identical to the grand Order Total already shown at the bottom — showing
   * both is pure duplication. Defaults to `true` (useful, non-duplicate
   * per-seller breakdown) and is only turned off by the caller when there's
   * exactly one group.
   */
  showTotals?: boolean;
}

/**
 * One seller's order preview: seller label, items, and (optionally) totals.
 * Renders as a plain block, not its own bordered card — checkout is one
 * continuous sheet now, and `CheckoutForm` separates multiple groups with a
 * divider between them.
 */
export function CheckoutGroupCard({ group, showTotals = true }: CheckoutGroupCardProps) {
  return (
    <section
      aria-label={`Order from ${group.sellerName ?? "this seller"}`}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-red-dark">
          {group.sellerName ?? "Seller"}
        </p>
        <span className="text-[9.5px] font-medium text-rj-gray-500">Fulfilled locally</span>
      </div>
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
