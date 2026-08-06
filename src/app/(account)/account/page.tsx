import type { Metadata } from "next";

import { OverviewSummary } from "@/features/account/components/OverviewSummary";
import { RecentOrdersList } from "@/features/account/components/RecentOrdersList";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { getBuyerOrderSummary, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await requireSessionUser();
  const summary = await getBuyerOrderSummary(user.id);
  const firstName = user.fullName?.trim().split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title={firstName ? `Hi, ${firstName}` : "My Account"}
        description="Track your orders and keep your details up to date."
      />
      <OverviewSummary statusCounts={summary.statusCounts} />
      <RecentOrdersList orders={summary.recentOrders} />
    </div>
  );
}
