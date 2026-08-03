export const USER_ROLES = {
  buyer: "buyer",
  seller: "seller",
  admin: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  admin: "Administrator",
};

/** Roles allowed to reach the seller/admin dashboard. */
export const DASHBOARD_ROLES: readonly UserRole[] = [
  USER_ROLES.seller,
  USER_ROLES.admin,
];
