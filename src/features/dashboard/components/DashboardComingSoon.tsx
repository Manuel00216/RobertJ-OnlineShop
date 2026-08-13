import { EmptyState } from "@/components/feedback/EmptyState";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";

/**
 * Honest static placeholder for a not-yet-built dashboard section — no
 * fetching, no fabricated numbers. Later phases replace the page that
 * renders this with real content; this component itself never changes.
 */
export function DashboardComingSoon({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader eyebrow={eyebrow} title={title} />
      <EmptyState
        title="Coming soon"
        description={description}
      />
    </div>
  );
}
