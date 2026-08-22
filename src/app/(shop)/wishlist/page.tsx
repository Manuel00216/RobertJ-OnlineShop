import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { listWishlistProducts, requireSessionUser } from "@/lib/supabase/queries";
import type { Product } from "@/features/products/types/product.types";

export const metadata: Metadata = { title: "My Wishlist" };

export default async function WishlistPage() {
  // `proxy.ts` already guards /wishlist; this is the belt-and-suspenders re-check.
  const user = await requireSessionUser();

  let products: Product[] = [];
  let loadError = false;
  try {
    products = await listWishlistProducts(user.id);
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Saved"
        title="My Wishlist"
        description="Products you've saved for later."
      />
      {loadError ? (
        <ErrorState message="We couldn't load your wishlist right now." />
      ) : products.length === 0 ? (
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
