import type { Metadata } from "next";

import { DashboardComingSoon } from "@/features/dashboard/components/DashboardComingSoon";

export const metadata: Metadata = { title: "Inventory — Dashboard" };

export default function DashboardInventoryPage() {
  return (
    <DashboardComingSoon
      eyebrow="Dashboard"
      title="Inventory"
      description="Manage stock levels here once this section ships."
    />
  );
}
