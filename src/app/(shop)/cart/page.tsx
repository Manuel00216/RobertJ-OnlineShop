import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/constants/roles";
import { CartRecommendations } from "@/features/cart/components/CartRecommendations";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { canPurchase } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await getSessionUser();
  // Buyer-only transaction route: seller/admin can browse the storefront but
  // not the cart. Guests (null) and buyers pass through.
  if (user && !canPurchase(user.role as UserRole)) redirect(ROUTES.home);

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
