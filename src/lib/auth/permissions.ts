import { USER_ROLES, type UserRole } from "@/constants/roles";

/** Pure, framework-free permission checks shared by server and client code. */
export function canManageProducts(role: UserRole) {
  return role === USER_ROLES.seller || role === USER_ROLES.admin;
}

export function canViewDashboard(role: UserRole) {
  return canManageProducts(role);
}

export function canManageUsers(role: UserRole) {
  return role === USER_ROLES.admin;
}
