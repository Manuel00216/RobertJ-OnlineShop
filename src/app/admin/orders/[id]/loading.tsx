import { Skeleton } from "@/components/ui/skeleton";

export default function AdminOrderDetailLoading() {
  return (
    <div className="flex flex-col gap-8 p-5 lg:p-7" role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 bg-gray-100" />
          <Skeleton className="h-9 w-56 bg-gray-100" />
          <Skeleton className="h-3 w-32 bg-gray-100" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl bg-gray-100" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-20 w-full rounded-2xl bg-gray-100" />
          <Skeleton className="h-20 w-full rounded-2xl bg-gray-100" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
