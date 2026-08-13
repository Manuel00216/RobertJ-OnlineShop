export interface Shop {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A shop plus its current `shop_users` member (if any) — for the admin Shops management screen. */
export interface ShopWithMember extends Shop {
  memberId: string | null;
  /** Member's display name (full name, falling back to username), or null if unassigned. */
  memberName: string | null;
}
