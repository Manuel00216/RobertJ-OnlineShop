import type { Metadata } from "next";

import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { CheckoutForm } from "@/features/checkout/components/CheckoutForm";
import { requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  // `proxy.ts` already guards /checkout; this is the belt-and-suspenders re-check.
  await requireSessionUser();

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Checkout"
        title="Checkout"
        description="Review your order, add a delivery address, and place your order."
      />
      <CheckoutForm />
    </div>
  );
}
