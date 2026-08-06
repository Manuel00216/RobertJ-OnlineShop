import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account-shell loading state. Rendered inside `AccountShell`'s main column
 * while a segment (overview / orders / profile) streams its first render.
 */
export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-live="polite">
      <span className="sr-only">Loading your account</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24 bg-rj-gray-100" />
        <Skeleton className="h-9 w-64 bg-rj-gray-100" />
        <Skeleton className="h-3 w-40 bg-rj-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl bg-rj-gray-100" />
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-2xl bg-rj-gray-100" />
      <Skeleton className="h-16 w-full rounded-2xl bg-rj-gray-100" />
    </div>
  );
}
