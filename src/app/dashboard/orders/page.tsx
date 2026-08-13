import type { Metadata } from "next";

import { DashboardComingSoon } from "@/features/dashboard/components/DashboardComingSoon";

export const metadata: Metadata = { title: "Orders — Dashboard" };

export default function DashboardOrdersPage() {
  return (
    <DashboardComingSoon
      eyebrow="Dashboard"
      title="Orders"
      description="Fulfil and track incoming orders here once this section ships."
    />
  );
}
