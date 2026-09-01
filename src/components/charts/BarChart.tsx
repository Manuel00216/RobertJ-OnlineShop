import { cn } from "@/lib/utils/cn";

export type BarChartTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface BarChartDatum {
  label: string;
  value: number;
  /** Human-readable value shown at the end of the row (defaults to `value`). */
  valueLabel?: string;
  tone?: BarChartTone;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** Accessible description of the whole chart. */
  ariaLabel: string;
  className?: string;
}

const TONE_BAR: Record<BarChartTone, string> = {
  // `rj-gray-300` was never a defined token — this tone rendered invisibly
  // before. `rj-gray-200` gives "neutral" an actual visible bar.
  neutral: "bg-rj-gray-200",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Dependency-free horizontal bar list for categorical comparisons (status
 * breakdown, top products, payment split). Each row pairs a text label and
 * value with a proportional track, so it stays legible and fully accessible
 * without a canvas/SVG. Bars scale to the largest value in the set.
 */
export function BarChart({ data, ariaLabel, className }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className={cn("flex flex-col gap-3", className)} aria-label={ariaLabel}>
      {data.map((d) => {
        const pct = Math.max(2, Math.round((d.value / max) * 100));
        return (
          <li key={d.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-rj-black">{d.label}</span>
              <span className="shrink-0 font-medium text-rj-gray-600">
                {d.valueLabel ?? d.value}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-rj-gray-100"
              role="presentation"
            >
              <div
                className={cn("h-full rounded-full", TONE_BAR[d.tone ?? "neutral"])}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
