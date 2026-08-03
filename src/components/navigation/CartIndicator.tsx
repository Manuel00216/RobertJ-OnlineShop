"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";

export function CartIndicator() {
  const { itemCount } = useCart();

  return (
    <Link
      href={ROUTES.cart}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {itemCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
