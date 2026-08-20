import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/EmptyState";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { listWishlistProducts, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "My Wishlist" };

export default async function WishlistPage() {
  // `proxy.ts` already guards /wishlist; this is the belt-and-suspenders re-check.
  const user = await requireSessionUser();
  const products = await listWishlistProducts(user.id);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Saved"
        title="My Wishlist"
        description="Products you've saved for later."
      />
      {products.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here."
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
