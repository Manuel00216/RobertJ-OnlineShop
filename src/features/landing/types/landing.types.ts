import type { ReactNode } from "react";

/**
 * Featured-shop card model — real `shops` rows plus a real active-product
 * count (see `getFeaturedShops` in queries.ts). No rating/badge/cover-image
 * fields: the schema has no data source for any of those, and this project
 * doesn't fabricate marketplace signals (same principle `ProductJsonLd`
 * already follows for product ratings).
 */
export interface FeaturedShop {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

/** A "why RobertJ" value-proposition card. `icon` is a Lucide element. */
export interface MarketplaceFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

/** A headline metric rendered with an animated counter. */
export interface LandingStat {
  /** Hardcoded value. Used directly for placeholders, or as the live fallback. */
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  /** Fractional digits to display (e.g. 1 for a 4.8 rating). Defaults to 0. */
  decimals?: number;
  /**
   * `live` — replaced with a real Supabase count when one exists (see `metric`);
   * `placeholder` — a marketing figure with no DB source yet (buyers, sales,
   * rating), shown as-is until the supporting data exists.
   */
  source: "live" | "placeholder";
  /** Which live count feeds this stat. Required when `source` is `live`. */
  metric?: "sellerCount" | "productCount";
}

/** One turn in the Smart Assistant demo transcript. */
export interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * Flattened product model consumed by the Featured Products grid. Built only
 * from real, active, `featured` DB products (see `FeaturedProducts.tsx`) —
 * this project doesn't fabricate marketplace signals (same principle
 * `FeaturedShop` follows), so there is no placeholder/fallback variant.
 */
export interface FeaturedProductView {
  key: string;
  name: string;
  shop: string;
  priceCents: number;
  /** Real compare-at price, when a verified source for one exists. No such
   * source exists in the schema today, so this is always null. */
  originalPriceCents: number | null;
  imageUrl: string;
  category: string;
  isNew: boolean;
  isSale: boolean;
  href: string;
  // Fields needed to build a real cart item — always set, every view is real.
  productId: string;
  slug: string;
  currency: string;
  maxQuantity: number;
  sellerId: string;
}
