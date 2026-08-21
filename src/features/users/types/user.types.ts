import type { UserRole } from "@/constants/roles";

/** Domain model for the admin Users management screen (`admin_list_users()` RPC). */
export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  /** Current shop assignment, or null if unassigned (always null for buyers/admins). */
  shopId: string | null;
  shopName: string | null;
  /** Admin-controlled account state — sole write path: `admin_set_user_active()`. */
  isActive: boolean;
}
