import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder list while the order history loads. */
export function OrderSkeletons({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading your orders</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-2xl border border-rj-gray-100 p-4"
        >
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl bg-rj-gray-100" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/3 bg-rj-gray-100" />
            <Skeleton className="h-3 w-1/4 bg-rj-gray-100" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-rj-gray-100" />
        </div>
      ))}
    </div>
  );
}
