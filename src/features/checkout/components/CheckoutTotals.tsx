import { formatCurrency } from "@/lib/utils/currency";

/**
 * Money rows for a seller group (or the whole cart when passed summed values).
 * `title` is the small eyebrow shown above the rows.
 */
export function CheckoutTotals({
  title = "Order summary",
  subtotalCents,
  shippingFeeCents,
  totalCents,
  currency,
}: {
  title?: string;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  currency: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5 border-t border-rj-gray-100 pt-4 text-sm">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        {title}
      </h3>
      <div className="flex items-center justify-between gap-2">
        <span className="text-rj-gray-600">Subtotal</span>
        <span className="font-medium text-rj-black">
          {formatCurrency(subtotalCents, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-rj-gray-600">Shipping</span>
        <span className="font-medium text-rj-black">
          {shippingFeeCents === 0
            ? "Free"
            : formatCurrency(shippingFeeCents, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-rj-gray-200 pt-2.5">
        <span className="font-bold text-rj-black">Total</span>
        <span className="text-base font-bold text-rj-black">
          {formatCurrency(totalCents, currency)}
        </span>
      </div>
    </section>
  );
}
