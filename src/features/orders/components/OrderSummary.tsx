import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import type { Order } from "@/features/orders/types/order.types";

/** Order totals card: subtotal / shipping / total. `themed`: see OrderHeader. */
export function OrderSummary({ order, themed = false }: { order: Order; themed?: boolean }) {
  const ink = themed ? "text-foreground" : "text-rj-black";
  const muted = themed ? "text-muted-foreground" : "text-rj-gray-600";
  return (
    <section
      aria-label="Order summary"
      className={cn(
        "rounded-2xl border p-5",
        themed ? "border-border bg-muted" : "border-rj-gray-100 bg-rj-gray-50",
      )}
    >
      <h2 className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", muted)}>Summary</h2>
      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className={muted}>Subtotal</dt>
          <dd className={cn("font-medium", ink)}>
            {formatCurrency(order.subtotalCents, order.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className={muted}>Shipping</dt>
          <dd className={cn("font-medium", ink)}>
            {order.shippingFeeCents === 0
              ? "Free"
              : formatCurrency(order.shippingFeeCents, order.currency)}
          </dd>
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-t pt-2.5",
            themed ? "border-border" : "border-rj-gray-200",
          )}
        >
          <dt className={cn("font-bold", ink)}>Total</dt>
          <dd className={cn("text-base font-bold", ink)}>
            {formatCurrency(order.totalCents, order.currency)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
