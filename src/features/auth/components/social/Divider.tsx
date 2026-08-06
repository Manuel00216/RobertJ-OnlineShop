import { cn } from "@/lib/utils/cn";

export interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label = "OR", className }: DividerProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} role="separator">
      <div className="h-px flex-1 bg-rj-gray-200" />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-rj-gray-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-rj-gray-200" />
    </div>
  );
}
