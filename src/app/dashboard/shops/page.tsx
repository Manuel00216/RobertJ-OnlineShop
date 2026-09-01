import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";

/** Moved to the Admin Portal — kept as a redirect so old bookmarks still land somewhere useful. */
export default function DashboardShopsRedirectPage() {
  redirect(ROUTES.adminShops);
}
