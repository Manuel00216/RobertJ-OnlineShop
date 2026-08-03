import type {
  AssistantMessage,
  FeaturedShop,
  LandingStat,
} from "@/features/landing/types/landing.types";

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

/**
 * PLACEHOLDER: the current schema has no shop entity carrying cover image,
 * rating, or badge. Rendered as clearly-marked placeholder data; replace with a
 * service call returning `FeaturedShop[]` once a `shops` concept is added.
 */
export const FEATURED_SHOPS_PLACEHOLDER: FeaturedShop[] = [
  {
    id: "maison-atelier",
    name: "Maison Atelier",
    category: "Women's Fashion",
    rating: 4.9,
    productCount: 218,
    imageUrl: "/landing/shop-maison-atelier.jpg",
    badge: "Top Seller",
  },
  {
    id: "urbanthread",
    name: "UrbanThread Co.",
    category: "Men's Streetwear",
    rating: 4.8,
    productCount: 184,
    imageUrl: "/landing/shop-urbanthread.jpg",
    badge: "New Shop",
  },
  {
    id: "minimal-edit",
    name: "The Minimal Edit",
    category: "Unisex Basics",
    rating: 4.7,
    productCount: 97,
    imageUrl: "/landing/shop-minimal-edit.jpg",
  },
  {
    id: "studio-loom",
    name: "Studio Loom",
    category: "Linen & Lux",
    rating: 4.9,
    productCount: 142,
    imageUrl: "/landing/shop-studio-loom.jpg",
    badge: "Featured",
  },
  {
    id: "drift-drape",
    name: "Drift & Drape",
    category: "Resort Wear",
    rating: 4.6,
    productCount: 76,
    imageUrl: "/landing/shop-drift-drape.jpg",
  },
  {
    id: "cleanline",
    name: "CleanLine Studio",
    category: "Contemporary Cuts",
    rating: 4.8,
    productCount: 203,
    imageUrl: "/landing/shop-cleanline.jpg",
  },
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

/** Category filter chips for the Featured Products grid. */
export const PRODUCT_FILTERS = [
  "All",
  "Women's",
  "Men's",
  "Essentials",
  "Sale",
] as const;

/**
 * Shown only when no products are flagged `featured` in the database yet.
 * Prices are in centavos to match the domain model. `productId: null` marks
 * these as non-purchasable placeholders (quick-add routes to the catalog).
 */
export const FEATURED_PRODUCTS_PLACEHOLDER = [
  { name: "Oversized Linen Blazer", shop: "Maison Atelier", priceCents: 420000, originalPriceCents: 580000, imageUrl: "/landing/product-linen-blazer.jpg", category: "Women's", isSale: true, isNew: false },
  { name: "Heritage Wool Coat", shop: "CleanLine Studio", priceCents: 780000, originalPriceCents: null, imageUrl: "/landing/product-wool-coat.jpg", category: "Men's", isSale: false, isNew: true },
  { name: "Classic Knit Pullover", shop: "The Minimal Edit", priceCents: 195000, originalPriceCents: null, imageUrl: "/landing/product-knit-pullover.jpg", category: "Essentials", isSale: false, isNew: false },
  { name: "Varsity Bomber Jacket", shop: "UrbanThread Co.", priceCents: 340000, originalPriceCents: 420000, imageUrl: "/landing/product-bomber-jacket.jpg", category: "Streetwear", isSale: true, isNew: false },
  { name: "Silk Wrap Dress", shop: "Drift & Drape", priceCents: 310000, originalPriceCents: null, imageUrl: "/landing/product-silk-dress.jpg", category: "Women's", isSale: false, isNew: true },
  { name: "Tailored Chino Trousers", shop: "Studio Loom", priceCents: 220000, originalPriceCents: null, imageUrl: "/landing/product-chino-trousers.jpg", category: "Men's", isSale: false, isNew: false },
  { name: "Merino Turtleneck", shop: "The Minimal Edit", priceCents: 168000, originalPriceCents: null, imageUrl: "/landing/product-merino-turtleneck.jpg", category: "Essentials", isSale: false, isNew: true },
  { name: "Relaxed Denim Set", shop: "UrbanThread Co.", priceCents: 360000, originalPriceCents: 450000, imageUrl: "/landing/product-denim-set.jpg", category: "Denim", isSale: true, isNew: false },
] as const;

/** Bullet points beside the Smart Assistant chat preview. */
export const ASSISTANT_BENEFITS = [
  "Understands natural language queries",
  "Searches all 120+ shops simultaneously",
  "Filters by size, price, and shop rating",
  "Gets smarter with every search",
] as const;

/** Seeded demo transcript for the Smart Assistant preview. */
export const ASSISTANT_TRANSCRIPT: AssistantMessage[] = [
  {
    role: "assistant",
    text: "Hi! I'm your RobertJ shopping assistant. Tell me what you're looking for — style, budget, occasion, size — and I'll find the best picks across all 120+ shops.",
  },
  {
    role: "user",
    text: "I'm looking for a casual outfit for a beach trip, budget around ₱3,000.",
  },
  {
    role: "assistant",
    text: "Perfect for the beach! I found 3 shops with linen sets and resort wear under ₱3,000 — Drift & Drape has a linen co-ord at ₱2,400, and Studio Loom has relaxed wide-leg trousers at ₱1,950. Want me to filter by size?",
  },
];

export const ASSISTANT_REPLY =
  "Great question! I found several matching options across our verified shops. Filtering now by your preferences — price range, available sizes, and top-rated sellers. Here are the top 4 picks for you.";

/** Footer navigation. Links are placeholders until those routes ship. */
export const FOOTER_COLUMNS = [
  {
    heading: "Marketplace",
    links: [
      "Browse Shops",
      "New Arrivals",
      "Sale Items",
      "All Categories",
      "Trending Now",
    ],
  },
  {
    heading: "Sellers",
    links: [
      "Open a Shop",
      "Seller Dashboard",
      "Guidelines",
      "Seller Stories",
      "Support",
    ],
  },
  {
    heading: "Help",
    links: [
      "How It Works",
      "Shipping Policy",
      "Returns & Refunds",
      "FAQs",
      "Contact Us",
    ],
  },
] as const;

export const FOOTER_TRUST_BADGES = [
  "Verified Sellers",
  "Buyer Protected",
  "Secure Payments",
] as const;

export const FOOTER_LEGAL_LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Cookie Settings",
] as const;

export const NAV_LINKS = ["Shops", "Categories", "New Arrivals", "Sale"] as const;
