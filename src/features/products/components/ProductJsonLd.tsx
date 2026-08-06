import { PRODUCT_CONDITION } from "@/constants/status";
import { siteConfig } from "@/config/site";
import type { Product } from "@/features/products/types/product.types";

export interface ProductJsonLdProps {
  product: Product;
  /** Absolute URL of the product's own detail page. */
  url: string;
}

/**
 * Schema.org Product structured data, rendered server-side only — no
 * "use client", so there is nothing to hydrate and no mismatch risk. Every
 * field is derived from real product data; nothing is fabricated. Fields the
 * schema has no source for (aggregateRating/review — this app has no review
 * data, deliberately out of SAD scope) are omitted rather than faked, since
 * fabricated ratings are a Google structured-data policy violation.
 */
export function ProductJsonLd({ product, url }: ProductJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.description ? { description: product.description } : {}),
    // `product_images.url` is already absolute (DB CHECK enforces `^https?://`).
    image: product.images.map((image) => image.url),
    // No dedicated SKU column exists in this schema — the product id is the
    // closest stable, unique identifier available.
    sku: product.id,
    brand: {
      "@type": "Organization",
      name: product.sellerName ?? siteConfig.name,
    },
    ...(product.categoryName ? { category: product.categoryName } : {}),
    // Schema.org only has three condition values; this app tracks five, so
    // anything short of "new" maps to UsedCondition (no closer equivalent).
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency,
      price: (product.priceCents / 100).toFixed(2),
      availability:
        product.quantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition:
        product.condition === PRODUCT_CONDITION.new
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      seller: {
        "@type": "Organization",
        name: product.sellerName ?? siteConfig.name,
      },
    },
  };

  // Escape "<" so a title/description containing "</script>" can't break out
  // of the tag (the standard mitigation for JSON-LD via dangerouslySetInnerHTML).
  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
