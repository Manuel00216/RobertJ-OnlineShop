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

/** A shop plus its current `shop_users` member (if any) — for the admin Shops management screen. */
export interface ShopWithMember extends Shop {
  memberId: string | null;
  /** Member's display name (full name, falling back to username), or null if unassigned. */
  memberName: string | null;
}
