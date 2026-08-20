import Image from "next/image";
import Link from "next/link";

import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getSessionUser,
  getShopNamesBySellerIds,
  listWishlistProductIds,
} from "@/lib/supabase/queries";
import { ProductTile, type ProductTileItem } from "@/features/products/components/ProductTile";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { getCoverImage, type Product } from "@/features/products/types/product.types";

export interface ProductGridProps {
  products: Product[];
  /** Defaults to "grid". "list" renders compact horizontal rows instead —
   * same underlying tile data, just a denser layout for scanning many items. */
  viewMode?: "grid" | "list";
  /** When set, the empty state names the search term instead of a generic message. */
  searchTerm?: string;
}

/** One row in the "list" view — same fields as `ProductTile`, laid out horizontally. */
function ProductListRow({ item }: { item: ProductTileItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-4 rounded-xl border border-rj-gray-100 bg-rj-white p-3 transition-colors hover:border-rj-gray-200"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-rj-gray-100">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-medium tracking-widest text-rj-gray-400">
            {item.shopName}
          </p>
          <p className="line-clamp-1 text-sm font-medium text-rj-black">{item.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-bold text-rj-black">
            {formatCurrency(item.priceCents, item.currency)}
          </span>
          {item.wishlist ? (
            <WishlistButton
              productId={item.wishlist.productId}
              initialSaved={item.wishlist.initialSaved}
              isAuthenticated={item.wishlist.isAuthenticated}
              variant="tile"
            />
          ) : null}
        </div>
      </Link>
    </li>
  );
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

export async function ProductGrid({
  products,
  viewMode = "grid",
  searchTerm,
}: ProductGridProps) {
  if (products.length === 0) {
    return searchTerm ? (
      <EmptyState
        title={`No results for "${searchTerm}"`}
        description="Check the spelling, try a shorter term, or browse by category instead."
      />
    ) : (
      <EmptyState
        title="No products found"
        description="Try adjusting your filters or browse another category."
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

  const items = products.map((product) =>
    toTileItem(product, wishlistedIds, user !== null, shopNames),
  );

  if (viewMode === "list") {
    return (
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ProductListRow key={item.key} item={item} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.key}>
          <ProductTile item={item} />
        </li>
      ))}
    </ul>
  );
}
