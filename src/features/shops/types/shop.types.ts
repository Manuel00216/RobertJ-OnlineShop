export interface Shop {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Real, seller-uploaded branding — null until the shop's owner sets it.
   * Never a fabricated/placeholder value; always a `shop-images` Storage URL. */
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
}

/** One shop_users member's identity, as shown on the admin Shops management screen. */
export interface ShopMember {
  id: string;
  /** Display name (full name, falling back to username). */
  name: string;
}

/**
 * A shop plus every current `shop_users` member — a shop can have more than
 * one (co-sellers), so this is an array, never just "the" member. Empty when
 * unassigned.
 */
export interface ShopWithMember extends Shop {
  members: ShopMember[];
}
