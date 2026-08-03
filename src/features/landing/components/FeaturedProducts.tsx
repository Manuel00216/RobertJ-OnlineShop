import { ROUTES } from "@/constants/routes";
import { FeaturedProductsGrid } from "@/features/landing/components/FeaturedProductsGrid";
import { FEATURED_PRODUCTS_PLACEHOLDER } from "@/features/landing/constants/landing.constants";
import type { FeaturedProductView } from "@/features/landing/types/landing.types";
import { getCoverImage } from "@/features/products/types/product.types";
import { listFeaturedProducts } from "@/lib/supabase/queries";

const FALLBACK_IMAGE = "/landing/product-knit-pullover.jpg";

/** Placeholder featured products rendered when nothing is flagged featured. */
function placeholderViews(): FeaturedProductView[] {
  return FEATURED_PRODUCTS_PLACEHOLDER.map((item, i) => ({
    key: `placeholder-${i}`,
    name: item.name,
    shop: item.shop,
    priceCents: item.priceCents,
    originalPriceCents: item.originalPriceCents,
    imageUrl: item.imageUrl,
    category: item.category,
    isNew: item.isNew,
    isSale: item.isSale,
    href: ROUTES.products,
    productId: null,
    slug: null,
    currency: "PHP",
    maxQuantity: 0,
    sellerId: null,
  }));
}

/**
 * "Picked for You" featured products. Fetches active, featured products from
 * Supabase and maps them into the grid's view model; when none are featured yet
 * it falls back to clearly-marked placeholder items. Sale/New are derived from
 * the `tags` convention (no compare-at column exists in the schema).
 */
export async function FeaturedProducts() {
  let views: FeaturedProductView[];

  try {
    const products = await listFeaturedProducts(8);
    views =
      products.length > 0
        ? products.map((product) => ({
            key: product.id,
            name: product.title,
            shop: product.sellerName ?? "RobertJ Seller",
            priceCents: product.priceCents,
            originalPriceCents: null,
            imageUrl: getCoverImage(product)?.url ?? FALLBACK_IMAGE,
            category: product.categoryName ?? "",
            isNew: product.tags.includes("new"),
            isSale: product.tags.includes("sale"),
            href: ROUTES.productDetail(product.slug),
            productId: product.id,
            slug: product.slug,
            currency: product.currency,
            maxQuantity: product.quantity,
            sellerId: product.sellerId,
          }))
        : placeholderViews();
  } catch {
    views = placeholderViews();
  }

  return (
    <section className="bg-rj-white py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <FeaturedProductsGrid products={views} />
      </div>
    </section>
  );
}
