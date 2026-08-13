import type { Metadata } from "next";

import { DashboardComingSoon } from "@/features/dashboard/components/DashboardComingSoon";

export const metadata: Metadata = { title: "Reports — Dashboard" };

export default function DashboardReportsPage() {
  return (
    <DashboardComingSoon
      eyebrow="Dashboard"
      title="Reports"
      description="Sales and performance analytics will appear here once this section ships."
    />
  );
}
