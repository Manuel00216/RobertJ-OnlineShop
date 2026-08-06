import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import type { OrderItem } from "@/features/orders/types/order.types";

/**
 * Line items with snapshots. A sold/archived product resolves to a null slug,
 * so the title renders as plain text instead of a (dead) link.
 */
export function OrderItemsList({
  items,
  currency,
}: {
  items: OrderItem[];
  currency: string;
}) {
  return (
    <section aria-label="Items in this order" className="flex flex-col gap-3">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Items
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-rj-gray-100 bg-rj-white p-3"
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.productTitle}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-rj-gray-100 text-xs text-rj-gray-400">
                No image
              </span>
            )}

            <div className="min-w-0 flex-1">
              {item.productSlug ? (
                <Link
                  href={ROUTES.productDetail(item.productSlug)}
                  className="text-sm font-semibold text-rj-black hover:underline"
                >
                  {item.productTitle}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-rj-black">{item.productTitle}</p>
              )}
              <p className="mt-0.5 text-xs text-rj-gray-600">
                {item.quantity} × {formatCurrency(item.unitPriceCents, currency)}
              </p>
            </div>

            <p className="shrink-0 text-sm font-bold text-rj-black">
              {formatCurrency(item.subtotalCents, currency)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
