import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";
import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import { cn } from "@/lib/utils/cn";

export interface CheckoutEmptyStateProps {
  /** `empty`: the cart itself has nothing. `nothing-selected`: the cart has
   * items, but none are checked on the cart page's selective checkout. */
  reason?: "empty" | "nothing-selected";
}

/** Checkout with nothing to place yet — either an empty cart or an empty selection. */
export function CheckoutEmptyState({ reason = "empty" }: CheckoutEmptyStateProps) {
  const isNothingSelected = reason === "nothing-selected";

  return (
    <EmptyState
      title={isNothingSelected ? CHECKOUT_COPY.nothingSelectedTitle : CHECKOUT_COPY.emptyTitle}
      description={
        isNothingSelected
          ? CHECKOUT_COPY.nothingSelectedDescription
          : CHECKOUT_COPY.emptyDescription
      }
      action={
        <Link
          href={isNothingSelected ? ROUTES.cart : ROUTES.products}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        >
          {isNothingSelected ? "Back to cart" : "Browse products"}
        </Link>
      }
    />
  );
}
