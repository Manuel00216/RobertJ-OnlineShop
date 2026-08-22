import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder list for dashboard card-list pages (Products, Inventory,
 * Users, Shops) — mirrors those rows' shared shape (title + badge, meta
 * line, action buttons) so the skeleton doesn't visibly jump on load,
 * matching the pattern `OrderSkeletons` already uses for Orders.
 */
export function DashboardRowsSkeleton({
  rows = 5,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="border-rj-gray-100">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3 bg-rj-gray-100" />
              <Skeleton className="h-3 w-1/2 bg-rj-gray-100" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-md bg-rj-gray-100" />
              <Skeleton className="h-9 w-20 rounded-md bg-rj-gray-100" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
