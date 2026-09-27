import { USER_ROLES, type UserRole } from "@/constants/roles";

/**
 * Roles selectable via the admin Users list's role filter chips (M4: now
 * includes Admin — previously buyer/seller only). Single source for both
 * the page's `role` searchParam parsing and `UserRoleFilter`'s chips; I1
 * consolidates what used to be two separately-typed duplicates of this list.
 */
export const FILTERABLE_USER_ROLES: readonly UserRole[] = [
  USER_ROLES.buyer,
  USER_ROLES.seller,
  USER_ROLES.admin,
];

/** Type guard for the `role` search param — an unrecognized value is treated as "All". */
export function isFilterableUserRole(value: string | null | undefined): value is UserRole {
  return (FILTERABLE_USER_ROLES as readonly string[]).includes(value ?? "");
}
