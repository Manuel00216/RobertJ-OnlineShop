/**
 * One row from `admin_action_log` — append-only, admin-read-only, written
 * only by the specific RPCs that opted into logging (see each RPC's own
 * comment: `admin_assign_seller_shop`, `admin_set_user_active`,
 * `decide_return`). Not a general-purpose audit trail of every admin write.
 */
export interface AdminActionLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetShopId: string | null;
  targetShopName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
