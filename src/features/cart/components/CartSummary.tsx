"use client";

import Link from "next/link";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { formatCurrency } from "@/lib/utils/currency";
import { useCart } from "@/features/cart/hooks/useCart";

/** Line items plus subtotal, shared by the cart page and checkout. */
export function CartSummary() {
  const { items, subtotalCents, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Browse the marketplace to find something you like."
        action={
          <Link href={ROUTES.products}>
            <Button variant="outline">Browse products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.unitPriceCents, item.currency)} each
                </p>
              </div>

              <div className="flex items-center gap-2">
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
                  className="h-9 w-16 rounded-md border border-border bg-background px-2 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.productId)}
                  aria-label={`Remove ${item.title} from cart`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotalCents, items[0]?.currency)}</span>
        </div>
        <Link href={ROUTES.checkout}>
          <Button className="w-full">Proceed to checkout</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
