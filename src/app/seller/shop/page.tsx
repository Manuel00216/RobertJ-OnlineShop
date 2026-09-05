import { Suspense } from "react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/EmptyState";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { MyShopPanel } from "@/features/shops";
import { getOwnShopId, getShopById, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "My Shop — Seller Portal" };

async function MyShopData() {
  const user = await requireSessionUser();
  const shopId = await getOwnShopId(user.id);

  if (!shopId) {
    return (
      <EmptyState
        title="No shop assigned yet"
        description="Your account isn't linked to a shop yet. Contact an administrator to get set up."
      />
    );
  }

  const shop = await getShopById(shopId);
  if (!shop) {
    return (
      <EmptyState
        title="Shop not found"
        description="We couldn't load your shop. Contact an administrator."
      />
    );
  }

  return <MyShopPanel shop={shop} />;
}

export default function SellerShopPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<DashboardRowsSkeleton rows={1} label="Loading your shop" />}>
        <MyShopData />
      </Suspense>
    </div>
  );
}
