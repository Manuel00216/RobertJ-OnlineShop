import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Suspense fallback for the KPI grid + payment split. */
export function SalesSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-rj-gray-100">
            <CardContent className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  );
}

/** Generic card-shaped fallback for a single report panel. */
export function ReportCardSkeleton({ height = "h-64" }: { height?: string }) {
  return <Skeleton className={`w-full rounded-lg ${height}`} />;
}
