import type { Metadata } from "next";

import { CartRecommendations } from "@/features/cart/components/CartRecommendations";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { getSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await getSessionUser();

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Your Cart"
        title="Cart"
        description="Review the items you've added before checking out."
      />
      <CartSummary isAuthenticated={Boolean(user)} />
      <CartRecommendations />
    </div>
  );
}
