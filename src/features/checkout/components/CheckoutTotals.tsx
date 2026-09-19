import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";

export interface CheckoutTotalsProps {
  title?: string;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  currency: string;
  /**
   * `left` (default): full-width label/value rows with an eyebrow title —
   * used for each seller group's breakdown inside `CheckoutGroupCard`.
   * `right`: a compact, right-aligned block with no eyebrow — used for the
   * bottom-of-sheet grand summary next to the Place Order button.
   */
  align?: "left" | "right";
}

/**
 * Money rows for a seller group (or the whole cart when passed summed values).
 * `title` is the small eyebrow shown above the rows (only in the `left` layout).
 */
export function CheckoutTotals({
  title = "Order summary",
  subtotalCents,
  shippingFeeCents,
  totalCents,
  currency,
  align = "left",
}: CheckoutTotalsProps) {
  const isRight = align === "right";

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-2.5 text-sm",
        isRight ? "ml-auto w-full max-w-55" : "border-t border-rj-gray-100 pt-4",
      )}
    >
      {isRight ? null : (
        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
          {title}
        </h3>
      )}
      <div className="flex items-center justify-between gap-6">
        <span className="text-rj-gray-600">Subtotal</span>
        <span className="font-medium text-rj-black">
          {formatCurrency(subtotalCents, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-rj-gray-600">Shipping</span>
        <span className="font-medium text-rj-black">
          {shippingFeeCents === 0
            ? "Free"
            : formatCurrency(shippingFeeCents, currency)}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-6 border-t pt-2.5",
          isRight ? "border-rj-gray-100" : "border-rj-gray-200",
        )}
      >
        <span className="font-bold text-rj-black">Total</span>
        <span className={cn("font-bold text-rj-black", isRight ? "text-lg" : "text-base")}>
          {formatCurrency(totalCents, currency)}
        </span>
      </div>
    </section>
  );
}
