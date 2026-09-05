import Image from "next/image";

import type { Shop } from "@/features/shops/types/shop.types";

export interface ShopIdentityHeaderProps {
  shop: Shop;
}

/**
 * Real, seller-owned branding only — renders nothing at all when a shop
 * hasn't set a logo, banner, or description yet, rather than fabricating a
 * placeholder banner/description to fill the space. When there's no banner,
 * the banner strip itself is omitted entirely (not a dead gray box) and the
 * logo renders inline instead of overlapping a banner that doesn't exist.
 */
export function ShopIdentityHeader({ shop }: ShopIdentityHeaderProps) {
  if (!shop.logoUrl && !shop.bannerUrl && !shop.description) return null;

  const hasBanner = Boolean(shop.bannerUrl);

  return (
    <div className="overflow-hidden rounded-2xl border border-rj-gray-100">
      {shop.bannerUrl ? (
        // A true 3:1 aspect box (not a fixed height) so the crop window is
        // identical at every viewport width, matching the 3:1 preview the
        // seller sees while uploading (`ShopImageUploader`) — a fixed height
        // would make the effective aspect ratio (and thus the crop) drift
        // wider on large screens than on mobile.
        <div className="relative aspect-[3/1] w-full bg-rj-gray-100">
          <Image src={shop.bannerUrl} alt="" fill className="object-cover" sizes="100vw" />
        </div>
      ) : null}
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={`h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-rj-white bg-rj-black sm:h-20 sm:w-20 ${
            hasBanner ? "relative -mt-10" : "relative"
          }`}
        >
          {shop.logoUrl ? (
            <Image src={shop.logoUrl} alt={shop.name} fill className="object-cover" sizes="80px" />
          ) : (
            <span className="flex h-full items-center justify-center text-xl font-bold text-rj-white">
              {shop.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-rj-black">{shop.name}</h1>
          {shop.description ? (
            <p className="mt-1 text-sm text-rj-gray-600">{shop.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
