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
 * RobertJ Marketplace landing page. Section order mirrors the approved Figma
 * design. Data-backed sections (categories, featured products) fetch from
 * Supabase inside their own Server Components and fall back to placeholders.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <MarqueeBand />
      <FeaturedShops shops={FEATURED_SHOPS_PLACEHOLDER} />
      <ProductCategories />
      <FeaturedProducts />
      <EditorialBanner />
      <AboutSection />
      <MarketplaceFeatures />
      <SmartAssistantPreview />
    </>
  );
}
