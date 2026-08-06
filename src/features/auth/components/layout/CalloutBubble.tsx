import { cn } from "@/lib/utils/cn";

export interface CalloutBubbleProps {
  label: string;
  className?: string;
}

/**
 * Floating trust-badge card overlaid on the editorial panel's photo.
 * Caller positions each instance via `className` (absolute offsets).
 */
export function CalloutBubble({ label, className }: CalloutBubbleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl bg-rj-white/95 py-2.5 pl-3 pr-4 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <span className="h-6 w-1 shrink-0 rounded-full bg-rj-red" aria-hidden="true" />
      <span className="text-xs font-bold text-rj-black">{label}</span>
    </div>
  );
}
