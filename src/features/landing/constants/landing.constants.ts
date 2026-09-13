import type { LandingStat } from "@/features/landing/types/landing.types";

/** Rotating top-bar promos. Pure marketing copy — not modelled in the DB. */
export const ANNOUNCEMENTS = [
  "Free shipping on orders over ₱2,000  ·  Shop Now →",
  "New shops added weekly  ·  Explore the Marketplace →",
  "Secure checkout with buyer protection on every order",
] as const;

/** Trust-signal strip that scrolls beneath the hero. */
export const MARQUEE_ITEMS = [
  "New Arrivals Weekly",
  "Verified Filipino Sellers",
  "Free Shipping Over ₱2,000",
  "Secure Buyer Protection",
  "Shop 120+ Brands",
  "Easy Returns",
] as const;

/**
 * Hero headline metrics. `Active Shops` and `Products Listed` are backed by live
 * Supabase counts (the number here is only a fallback); `Happy Buyers` is a
 * marketing placeholder until buyer analytics exist.
 */
export const HERO_STATS: LandingStat[] = [
  { value: 120, suffix: "+", label: "Active Shops", source: "live", metric: "sellerCount" },
  { value: 8400, suffix: "+", label: "Products Listed", source: "live", metric: "productCount" },
  { value: 50000, suffix: "+", label: "Happy Buyers", source: "placeholder" },
];

/**
 * About-section metrics. `Verified Shops` is backed by a live seller count (the
 * number here is only a fallback); sales, buyers, and rating remain marketing
 * placeholders until orders / reviews data exist.
 */
export const ABOUT_STATS: LandingStat[] = [
  { value: 120, suffix: "+", label: "Verified Shops", source: "live", metric: "sellerCount" },
  { value: 18, prefix: "₱", suffix: "M+", label: "Sales Processed", source: "placeholder" },
  { value: 50000, suffix: "+", label: "Registered Buyers", source: "placeholder" },
  { value: 4.8, suffix: "★", label: "Average Rating", decimals: 1, source: "placeholder" },
];

/** Local fallbacks for categories whose `image_url` is null. */
export const CATEGORY_FALLBACK_IMAGES = [
  "/landing/category-womens.jpg",
  "/landing/category-mens.jpg",
  "/landing/category-outerwear.jpg",
  "/landing/category-essentials.jpg",
] as const;

/** Shown only when the categories table has not been seeded yet. */
export const CATEGORY_PLACEHOLDERS = [
  { name: "Women's", countLabel: "1,240+ items", imageUrl: "/landing/category-womens.jpg" },
  { name: "Men's", countLabel: "980+ items", imageUrl: "/landing/category-mens.jpg" },
  { name: "Outerwear", countLabel: "420+ items", imageUrl: "/landing/category-outerwear.jpg" },
  { name: "Essentials", countLabel: "610+ items", imageUrl: "/landing/category-essentials.jpg" },
] as const;

/**
 * Bullet points beside the Guided Selection preview. Describes the real
 * mechanism (DECISIONS.md ADR-009 — explicit, human-authored rules, never
 * AI/ML) — no natural-language or "learns over time" claims.
 */
export const ASSISTANT_BENEFITS = [
  "Matches by occasion, size, and budget — no guesswork",
  "Searches every shop's rules at once",
  "Budget is always checked against the live price",
  "Every match traces back to a rule a seller explicitly set — no black box",
] as const;
