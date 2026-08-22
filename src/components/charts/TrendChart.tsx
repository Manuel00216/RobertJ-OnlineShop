import { cn } from "@/lib/utils/cn";

export interface TrendChartPoint {
  /** Short axis label (e.g. "Aug 10"). */
  label: string;
  /** Numeric value plotted on the y-axis. */
  value: number;
  /** Human-readable value for the screen-reader table (e.g. "₱1,200.00"). */
  valueLabel: string;
}

export interface TrendChartProps {
  points: TrendChartPoint[];
  /** Accessible description of what the line represents. */
  ariaLabel: string;
  className?: string;
}

const VIEW_W = 640;
const VIEW_H = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };

/**
 * Dependency-free responsive SVG line + area chart. Business-agnostic: it takes
 * pre-shaped points and labels. Renders a visually-hidden data table so the
 * series is fully available to assistive tech (the SVG itself is `role="img"`).
 */
export function TrendChart({ points, ariaLabel, className }: TrendChartProps) {
  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...points.map((p) => p.value));

  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${x(points.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} ` +
        `L ${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`
      : "";

  // Thin out x labels so they never overlap on dense ranges.
  const labelStride = Math.ceil(points.length / 8) || 1;

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
      >
        {/* baseline */}
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={VIEW_W - PAD.right}
          y2={PAD.top + innerH}
          className="stroke-rj-gray-200"
          strokeWidth={1}
        />
        {areaPath ? <path d={areaPath} className="fill-rj-red/10" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            className="stroke-rj-red-dark"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={x(i)}
            cy={y(p.value)}
            r={points.length > 40 ? 0 : 2.5}
            className="fill-rj-red-dark"
          />
        ))}
        {points.map((p, i) =>
          i % labelStride === 0 ? (
            <text
              key={`lbl-${p.label}`}
              x={x(i)}
              y={VIEW_H - 6}
              textAnchor="middle"
              className="fill-rj-gray-400 text-[10px]"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={`row-${p.label}`}>
                <th scope="row">{p.label}</th>
                <td>{p.valueLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
