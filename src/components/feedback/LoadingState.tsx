import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingStateProps {
  /** Number of placeholder rows to render. */
  rows?: number;
  label?: string;
}

export function LoadingState({ rows = 3, label = "Loading" }: LoadingStateProps) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
