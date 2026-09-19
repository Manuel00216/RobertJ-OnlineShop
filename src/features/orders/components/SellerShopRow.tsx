import Link from "next/link";
import { Store } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

export interface SellerShopRowProps {
  shopName: string | null;
  /** Null when the seller has no resolvable shop membership — "View Shop" is omitted rather than linking to an unfiltered/broken catalog view. */
  shopId: string | null;
}

/** Seller identity row for the order-detail page — name + "View Shop" only, no Chat/Contact Seller (no messaging feature exists in this app). */
export function SellerShopRow({ shopName, shopId }: SellerShopRowProps) {
  if (!shopName) return null;

  return (
    <section
      aria-label="Seller"
      className={cn(RJ_CARD, "flex flex-wrap items-center justify-between gap-3 p-4")}
    >
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-rj-gray-500" aria-hidden="true" />
        <p className="text-sm font-bold text-rj-black">{shopName}</p>
      </div>
      {shopId ? (
        <Link
          href={`${ROUTES.products}?shopId=${shopId}`}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          View Shop
        </Link>
      ) : null}
    </section>
  );
}
