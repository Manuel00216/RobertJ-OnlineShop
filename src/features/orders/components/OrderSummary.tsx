import { formatCurrency } from "@/lib/utils/currency";
import type { Order } from "@/features/orders/types/order.types";

/** Order totals card: subtotal / shipping / total. */
export function OrderSummary({ order }: { order: Order }) {
  return (
    <section
      aria-label="Order summary"
      className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Summary
      </h2>
      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-rj-gray-600">Subtotal</dt>
          <dd className="font-medium text-rj-black">
            {formatCurrency(order.subtotalCents, order.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-rj-gray-600">Shipping</dt>
          <dd className="font-medium text-rj-black">
            {order.shippingFeeCents === 0
              ? "Free"
              : formatCurrency(order.shippingFeeCents, order.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-rj-gray-200 pt-2.5">
          <dt className="font-bold text-rj-black">Total</dt>
          <dd className="text-base font-bold text-rj-black">
            {formatCurrency(order.totalCents, order.currency)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
