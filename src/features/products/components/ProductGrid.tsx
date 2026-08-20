import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  getSessionUser,
  getShopNamesBySellerIds,
  listWishlistProductIds,
} from "@/lib/supabase/queries";
import { ProductTile, type ProductTileItem } from "@/features/products/components/ProductTile";
import { getCoverImage, type Product } from "@/features/products/types/product.types";

export interface ProductGridProps {
  products: Product[];
}

function toTileItem(
  product: Product,
  wishlistedIds: ReadonlySet<string>,
  isAuthenticated: boolean,
  shopNames: ReadonlyMap<string, string>,
): ProductTileItem {
  return {
    key: product.id,
    name: product.title,
    // Real shop name when the seller belongs to one (see
    // `resolve_shop_membership`); falls back to the seller's own profile
    // name for a legacy/unassigned seller (TD-1), then a generic label.
    shopName: shopNames.get(product.sellerId) ?? product.sellerName ?? "RobertJ Seller",
    priceCents: product.priceCents,
    originalPriceCents: null,
    currency: product.currency,
    imageUrl: getCoverImage(product)?.url ?? null,
    href: ROUTES.productDetail(product.slug),
    isNew: product.tags.includes("new"),
    isSale: product.tags.includes("sale"),
    conditionLabel:
      product.condition !== PRODUCT_CONDITION.new
        ? PRODUCT_CONDITION_LABELS[product.condition]
        : null,
    maxQuantity: product.quantity,
    addToCart: {
      productId: product.id,
      slug: product.slug,
      sellerId: product.sellerId,
      sellerName: product.sellerName,
    },
    wishlist: {
      productId: product.id,
      initialSaved: wishlistedIds.has(product.id),
      isAuthenticated,
    },
  };
}

export async function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="Try a different search term or browse another category."
      />
    );
  }

  // A couple of extra bulk queries per grid render, not per tile — same
  // shape as the existing `getSessionUser`/`listFeaturedProducts` pattern.
  // Either failing degrades gracefully (no hearts saved / seller-name
  // fallback) rather than breaking the grid.
  const user = await getSessionUser();
  const sellerIds = [...new Set(products.map((product) => product.sellerId))];
  const [wishlistedIds, shopNames] = await Promise.all([
    user
      ? listWishlistProductIds(user.id)
          .then((ids) => new Set(ids))
          .catch(() => new Set<string>())
      : Promise.resolve(new Set<string>()),
    getShopNamesBySellerIds(sellerIds).catch(() => new Map<string, string>()),
  ]);

  return (
    <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile
            item={toTileItem(product, wishlistedIds, user !== null, shopNames)}
          />
        </li>
      ))}
    </ul>
  );
}
