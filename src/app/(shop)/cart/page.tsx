import type { Metadata } from "next";

import { CartSummary } from "@/features/cart/components/CartSummary";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Your Cart"
        title="Cart"
        description="Review the items you've added before checking out."
      />
      <CartSummary />
    </div>
  );
}
