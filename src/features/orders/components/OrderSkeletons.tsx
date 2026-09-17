import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * Placeholder list while the order history loads. Shared by Buyer /orders and
 * both portals' Orders lists — pass `themed` from the portal pages only, so
 * the fallback matches the (themed) real content instead of flashing a fixed
 * mint skeleton over the dark page. Buyer omits it and keeps the rj-* look.
 */
export function OrderSkeletons({ rows = 4, themed = false }: { rows?: number; themed?: boolean }) {
  // Themed: drop the bg override so Skeleton uses its own theme-aware bg-muted.
  const border = themed ? "border-border" : "border-rj-gray-100";
  const block = themed ? undefined : "bg-rj-gray-100";
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">Loading your orders</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn("flex items-center gap-4 rounded-2xl border p-4", border)}
        >
          <Skeleton className={cn("h-16 w-16 shrink-0 rounded-xl", block)} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={cn("h-3.5 w-1/3", block)} />
            <Skeleton className={cn("h-3 w-1/4", block)} />
          </div>
          <Skeleton className={cn("h-6 w-20 rounded-full", block)} />
        </div>
      ))}
    </div>
  );
}
