import { FeaturedShopsCarousel } from "@/features/landing/components/FeaturedShopsCarousel";
import { getFeaturedShops } from "@/lib/supabase/queries";

/**
 * "Featured Shops" section. Fetches real shops with a real active-product
 * count from Supabase (see `getFeaturedShops`); renders nothing if the fetch
 * fails or no shops exist yet, rather than falling back to fabricated data.
 */
export async function FeaturedShops() {
  const shops = await getFeaturedShops().catch(() => []);
  return <FeaturedShopsCarousel shops={shops} />;
}
