import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ProductTile, type ProductTileItem } from "@/features/products/components/ProductTile";
import { getCoverImage, type Product } from "@/features/products/types/product.types";

export interface ProductGridProps {
  products: Product[];
}

function toTileItem(product: Product): ProductTileItem {
  return {
    key: product.id,
    name: product.title,
    shopName: product.sellerName ?? "RobertJ Seller",
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
  };
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="Try a different search term or browse another category."
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile item={toTileItem(product)} />
        </li>
      ))}
    </ul>
  );
}
