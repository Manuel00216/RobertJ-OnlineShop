import { ROUTES } from "@/constants/routes";
import { redirectToPortal } from "@/features/dashboard/utils/legacy-redirect";

interface DashboardOrderDetailRedirectPageProps {
  params: Promise<{ id: string }>;
}

/** Moved to the Admin/Seller Portal — kept as a redirect so old bookmarks still land somewhere useful. */
export default async function DashboardOrderDetailRedirectPage({
  params,
}: DashboardOrderDetailRedirectPageProps) {
  const { id } = await params;
  await redirectToPortal(ROUTES.adminOrderDetail(id), ROUTES.sellerOrderDetail(id));
}
