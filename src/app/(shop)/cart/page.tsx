import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { CartSummary } from "@/features/cart/components/CartSummary";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Your cart" />
      <CartSummary />
    </div>
  );
}
