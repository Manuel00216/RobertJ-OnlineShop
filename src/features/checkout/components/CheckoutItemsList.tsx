import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import type { CartItem } from "@/features/cart/types/cart.types";
import { getCartLineKey } from "@/features/cart/utils/cart-reducer";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * Cart line rows for one seller group in checkout — a compact table on
 * `sm:` and up (Product / Unit Price / Qty / Item Subtotal columns), falling
 * back to a stacked product-then-subtotal layout on narrow screens (the
 * unit-price/qty columns collapse out via `hidden sm:block`, and the mobile
 * "qty × price" line inside the product cell takes their place instead).
 */
export function CheckoutItemsList({
  items,
  currency,
}: {
  items: CartItem[];
  currency: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[1fr_88px_56px_88px] gap-4 pb-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-rj-gray-500 sm:grid">
        <span>Product</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Item subtotal</span>
      </div>
      <ul className="flex flex-col divide-y divide-rj-gray-100">
        {items.map((item) => (
          <li
            key={getCartLineKey(item)}
            className="grid grid-cols-1 gap-1.5 py-3 sm:grid-cols-[1fr_88px_56px_88px] sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 items-center gap-4">
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
                {item.variantLabel ? (
                  <p className="mt-0.5 text-xs text-rj-gray-500">{item.variantLabel}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-rj-gray-600 sm:hidden">
                  {item.quantity} × {formatCurrency(item.unitPriceCents, currency)}
                </p>
              </div>
            </div>

            <p className="hidden text-right text-sm text-rj-gray-600 sm:block">
              {formatCurrency(item.unitPriceCents, currency)}
            </p>
            <p className="hidden text-right text-sm text-rj-gray-600 sm:block">
              {item.quantity}
            </p>
            <p className="text-right text-sm font-bold text-rj-black">
              {formatCurrency(item.unitPriceCents * item.quantity, currency)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
