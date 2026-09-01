import { Suspense } from "react";
import type { Metadata } from "next";

import { AdminShopsPanel } from "@/features/shops/components/AdminShopsPanel";
import { DashboardRowsSkeleton } from "@/features/dashboard/components/DashboardRowsSkeleton";
import { listShopsWithMembers } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Shops — Admin Portal" };

async function AdminShopsData() {
  const shops = await listShopsWithMembers();
  return <AdminShopsPanel shops={shops} />;
}

export default function AdminShopsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <Suspense fallback={<DashboardRowsSkeleton label="Loading shops" />}>
        <AdminShopsData />
      </Suspense>
    </div>
  );
}
