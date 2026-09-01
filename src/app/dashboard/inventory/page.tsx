import { ROUTES } from "@/constants/routes";
import { redirectToPortal } from "@/features/dashboard/utils/legacy-redirect";

/** Moved to the Admin/Seller Portal — kept as a redirect so old bookmarks still land somewhere useful. */
export default async function DashboardInventoryRedirectPage() {
  await redirectToPortal(ROUTES.adminInventory, ROUTES.sellerInventory);
}
