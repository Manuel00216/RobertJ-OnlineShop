import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardOrderDetailLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 bg-rj-gray-100" />
          <Skeleton className="h-9 w-56 bg-rj-gray-100" />
          <Skeleton className="h-3 w-32 bg-rj-gray-100" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full bg-rj-gray-100" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl bg-rj-gray-100" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-20 w-full rounded-2xl bg-rj-gray-100" />
          <Skeleton className="h-20 w-full rounded-2xl bg-rj-gray-100" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl bg-rj-gray-100" />
      </div>
    </div>
  );
}
