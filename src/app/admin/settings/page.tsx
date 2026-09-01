import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/EmptyState";

export const metadata: Metadata = { title: "Settings — Admin Portal" };

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-5 lg:p-7">
      <EmptyState
        title="Coming soon"
        description="Platform configuration will appear here once this section ships."
      />
    </div>
  );
}
