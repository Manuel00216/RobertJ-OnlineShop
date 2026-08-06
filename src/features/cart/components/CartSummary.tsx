"use client";

import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { useCart } from "@/features/cart/hooks/useCart";

/** Line items plus subtotal on rj surfaces, shared by the cart page. */
export function CartSummary() {
  const { items, subtotalCents, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Browse the marketplace to find something you like."
        action={
          <Link
            href={ROUTES.products}
            className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
          >
            Browse products
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex items-center gap-4 rounded-2xl border border-rj-gray-100 bg-rj-white p-4 shadow-sm"
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.title}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-rj-gray-100">
                <Package className="h-6 w-6 text-rj-gray-400" aria-hidden="true" />
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
                {formatCurrency(item.unitPriceCents, item.currency)} each
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <label htmlFor={`qty-${item.productId}`} className="sr-only">
                Quantity for {item.title}
              </label>
              <input
                id={`qty-${item.productId}`}
                type="number"
                min={1}
                max={item.maxQuantity}
                value={item.quantity}
                onChange={(event) =>
                  setQuantity(item.productId, Number(event.target.value))
                }
                className="h-11 w-16 rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-2 text-center text-sm text-rj-black outline-none transition-colors focus-visible:border-rj-black"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => removeItem(item.productId)}
                aria-label={`Remove ${item.title} from cart`}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
        <div className="flex items-center justify-between text-sm font-semibold text-rj-black">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotalCents, items[0]?.currency)}</span>
        </div>
        <Link href={ROUTES.checkout}>
          <Button variant="rj" size="rj" className="w-full">
            Proceed to checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
