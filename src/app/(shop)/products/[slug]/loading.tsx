import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:gap-12" role="status" aria-live="polite">
      <Skeleton className="aspect-[3/4] w-full rounded-xl bg-rj-gray-100" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24 bg-rj-gray-100" />
        <Skeleton className="h-8 w-3/4 bg-rj-gray-100" />
        <Skeleton className="h-7 w-32 bg-rj-gray-100" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full bg-rj-gray-100" />
          <Skeleton className="h-8 w-24 rounded-full bg-rj-gray-100" />
        </div>
        <Skeleton className="h-4 w-full bg-rj-gray-100" />
        <Skeleton className="h-4 w-5/6 bg-rj-gray-100" />
        <Skeleton className="mt-2 h-11 w-full rounded-full bg-rj-gray-100 sm:w-40" />
      </div>
    </div>
  );
}
