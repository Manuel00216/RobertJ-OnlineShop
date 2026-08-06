import {
  AboutSection,
  EditorialBanner,
  FeaturedProducts,
  FeaturedShops,
  Hero,
  MarketplaceFeatures,
  MarqueeBand,
  ProductCategories,
  SmartAssistantPreview,
} from "@/features/landing";
import { FEATURED_SHOPS_PLACEHOLDER } from "@/features/landing/constants/landing.constants";

/**
 * RobertJ Marketplace landing page. Data-backed sections (categories, featured
 * products) fetch from Supabase inside their own Server Components and fall
 * back to placeholders. Section order: categories (broad orientation) before
 * the shop-level carousel (deeper discovery) — see ARCHITECTURE.md Module
 * Interactions / the homepage UX audit for why this was reordered from the
 * original Figma sequence.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <MarqueeBand />
      <ProductCategories />
      <FeaturedProducts />
      <FeaturedShops shops={FEATURED_SHOPS_PLACEHOLDER} />
      <EditorialBanner />
      <AboutSection />
      <MarketplaceFeatures />
      <SmartAssistantPreview />
    </>
  );
}
