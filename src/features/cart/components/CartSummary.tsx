"use client";

import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { checkCartAvailabilityAction } from "@/features/cart/actions/cart.actions";
import { useCart } from "@/features/cart/hooks/useCart";
import type { ProductPriceAndStock } from "@/lib/supabase/queries";

/** Line items plus subtotal on rj surfaces, shared by the cart page. */
export function CartSummary() {
  const { items, subtotalCents, setQuantity, removeItem, updateItem } =
    useCart();
  // Keyed by the exact id set it was fetched for, so a newly-added item isn't
  // momentarily flagged "unavailable" using a stale response from before it
  // existed in the cart — see the `checked` derivation below.
  const [availability, setAvailability] = useState<{
    key: string;
    data: Map<string, ProductPriceAndStock>;
  } | null>(null);
  const [, startChecking] = useTransition();

  // Stable key so the availability check only re-fires when the actual set of
  // product ids changes (e.g. after localStorage hydration), not on every
  // unrelated cart re-render.
  const idsKey = useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort().join(","),
    [items],
  );

  useEffect(() => {
    if (!idsKey) return;
    startChecking(async () => {
      const result = await checkCartAvailabilityAction(idsKey.split(","));
      if (result.success) {
        setAvailability({
          key: idsKey,
          data: new Map(result.data.map((entry) => [entry.id, entry])),
        });
      }
    });
  }, [idsKey]);

  const checked = availability?.key === idsKey;

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

  // `checked` is false until a fetch has resolved for this exact id set, so
  // an in-flight/not-yet-run check reads as "unknown," not "unavailable."
  const hasUnavailableItem =
    checked &&
    items.some((item) => {
      const live = availability?.data.get(item.productId);
      return !live || live.status !== "active" || live.quantity <= 0;
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const live = availability?.data.get(item.productId);
          const isUnavailable =
            checked && (!live || live.status !== "active" || live.quantity <= 0);
          const priceChanged =
            !isUnavailable && live && live.priceCents !== item.unitPriceCents;
          const lowStock =
            !isUnavailable && live && live.quantity < item.quantity;

          return (
            <li
              key={item.productId}
              className="flex flex-col gap-3 rounded-2xl border border-rj-gray-100 bg-rj-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
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
                  {isUnavailable ? null : (
                    <QuantityStepper
                      id={`qty-${item.productId}`}
                      value={item.quantity}
                      max={item.maxQuantity}
                      onChange={(quantity) => setQuantity(item.productId, quantity)}
                      aria-label={`Quantity for ${item.title}`}
                    />
                  )}
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
              </div>

              {isUnavailable ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-danger/5 px-3 py-2 text-xs font-semibold text-rj-red-dark"
                >
                  <span>This item is no longer available.</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="underline underline-offset-2"
                  >
                    Remove from cart
                  </button>
                </div>
              ) : null}

              {priceChanged && live ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-rj-gold/10 px-3 py-2 text-xs font-semibold text-rj-black"
                >
                  <span>
                    Price changed: was{" "}
                    {formatCurrency(item.unitPriceCents, item.currency)}, now{" "}
                    {formatCurrency(live.priceCents, item.currency)}.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(item.productId, { unitPriceCents: live.priceCents })
                    }
                    className="underline underline-offset-2"
                  >
                    Update price
                  </button>
                </div>
              ) : null}

              {lowStock && live ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-rj-gold/10 px-3 py-2 text-xs font-semibold text-rj-black"
                >
                  <span>Only {live.quantity} left in stock.</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateItem(item.productId, { maxQuantity: live.quantity });
                      setQuantity(item.productId, live.quantity);
                    }}
                    className="underline underline-offset-2"
                  >
                    Reduce to {live.quantity}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
        <div className="flex items-center justify-between text-sm font-semibold text-rj-black">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotalCents, items[0]?.currency)}</span>
        </div>
        {hasUnavailableItem ? (
          <p className="text-xs font-semibold text-rj-red-dark">
            Remove the unavailable item(s) above before checking out.
          </p>
        ) : null}
        <Link
          href={ROUTES.checkout}
          aria-disabled={hasUnavailableItem}
          onClick={(event) => {
            if (hasUnavailableItem) event.preventDefault();
          }}
        >
          <Button
            variant="rj"
            size="rj"
            className="w-full"
            disabled={hasUnavailableItem}
          >
            Proceed to checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
