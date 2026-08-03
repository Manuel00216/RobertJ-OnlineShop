import type { ReactNode } from "react";

/**
 * Featured-shop card model. The current database schema has no shop/seller-shop
 * entity that carries a cover image, rating, or badge, so this section is driven
 * by clearly-marked placeholder data (see landing.constants). When a `shops`
 * concept is added to the schema, swap the constant for a service call that
 * returns this same shape. — PLACEHOLDER: no shop entity in current schema.
 */
export interface FeaturedShop {
  id: string;
  name: string;
  category: string;
  rating: number;
  productCount: number;
  imageUrl: string;
  badge?: "Top Seller" | "New Shop" | "Featured";
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
 * Flattened product model consumed by the Featured Products grid. Built from
 * either real DB products or placeholder data. When `productId` is set the item
 * is a real, purchasable product; when null it is a placeholder that routes to
 * the catalog instead of adding to the cart.
 */
export interface FeaturedProductView {
  key: string;
  name: string;
  shop: string;
  priceCents: number;
  originalPriceCents: number | null;
  imageUrl: string;
  category: string;
  isNew: boolean;
  isSale: boolean;
  href: string;
  // Fields needed to build a real cart item; null for placeholders.
  productId: string | null;
  slug: string | null;
  currency: string;
  maxQuantity: number;
  sellerId: string | null;
}
