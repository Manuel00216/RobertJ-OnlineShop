import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import type { CartItem } from "@/features/cart/types/cart.types";
import { formatCurrency } from "@/lib/utils/currency";

/** Cart line rows for one seller group in checkout. */
export function CheckoutItemsList({
  items,
  currency,
}: {
  items: CartItem[];
  currency: string;
}) {
  return (
    <ul className="flex flex-col divide-y divide-rj-gray-100">
      {items.map((item) => (
        <li key={item.productId} className="flex items-center gap-4 py-3">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rj-gray-100 text-xs text-rj-gray-400">
              No image
            </span>
          )}

          <div className="min-w-0 flex-1">
            <Link
              href={ROUTES.productDetail(item.slug)}
              className="text-sm font-semibold text-rj-black hover:underline"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 text-xs text-rj-gray-600">
              {item.quantity} × {formatCurrency(item.unitPriceCents, currency)}
            </p>
          </div>

          <p className="shrink-0 text-sm font-bold text-rj-black">
            {formatCurrency(item.unitPriceCents * item.quantity, currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}
