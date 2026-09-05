import { Card, CardContent } from "@/components/ui/card";
import { ShopBrandingForm } from "@/features/shops/components/ShopBrandingForm";
import { ShopImageUploader } from "@/features/shops/components/ShopImageUploader";
import type { Shop } from "@/features/shops/types/shop.types";

export interface MyShopPanelProps {
  shop: Shop;
}

/**
 * Seller-facing shop branding editor: logo, banner, and description only —
 * name/slug/active status aren't editable here (admin-owned), and Featured
 * placement isn't shown or controllable here at all: it's a system-computed
 * ranking that branding never influences (see `getFeaturedShops`).
 *
 * Banner and logo are separate, full-width-stacked sections (not a
 * side-by-side grid) so the banner's wide aspect ratio and the logo's fixed
 * circular size both render at their natural proportions on every
 * breakpoint, instead of squeezing into an uneven half-width column.
 */
export function MyShopPanel({ shop }: MyShopPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-rj-black">{shop.name}</h2>
        <p className="text-sm text-rj-gray-500">
          Manage your shop&apos;s public branding. Homepage placement is determined
          automatically from your shop&apos;s activity and can&apos;t be set here.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col gap-4 p-5">
          <ShopImageUploader
            kind="banner"
            label="Banner"
            currentUrl={shop.bannerUrl}
            shopName={shop.name}
          />
          <ShopImageUploader
            kind="logo"
            label="Logo"
            currentUrl={shop.logoUrl}
            shopName={shop.name}
          />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <ShopBrandingForm shop={shop} />
        </CardContent>
      </Card>
    </div>
  );
}
