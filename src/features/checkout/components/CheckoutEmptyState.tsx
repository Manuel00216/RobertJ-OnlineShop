import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";
import { CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import { cn } from "@/lib/utils/cn";

/** Checkout with an empty cart — nothing to place yet. */
export function CheckoutEmptyState() {
  return (
    <EmptyState
      title={CHECKOUT_COPY.emptyTitle}
      description={CHECKOUT_COPY.emptyDescription}
      action={
        <Link
          href={ROUTES.products}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        >
          Browse products
        </Link>
      }
    />
  );
}
