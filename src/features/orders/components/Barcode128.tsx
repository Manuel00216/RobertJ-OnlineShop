import { encodeCode128B } from "@/features/orders/utils/code128";

export interface Barcode128Props {
  /** The value to encode — the RobertJ `order_number`. */
  value: string;
  /** Pixel width of a single module (bar unit). */
  moduleWidth?: number;
  /** Bar height in pixels. */
  height?: number;
  /** Show the human-readable value beneath the bars. */
  showText?: boolean;
}

/**
 * Renders a Code 128 barcode as self-contained inline SVG (no external assets,
 * no dependency) — safe for the print-isolated shipping label. If the value
 * can't be encoded it falls back to plain monospace text so the label never
 * breaks. This is display-only; scanning is handled by the scanner modal.
 */
export function Barcode128({
  value,
  moduleWidth = 2,
  height = 56,
  showText = true,
}: Barcode128Props) {
  let encoding;
  try {
    encoding = encodeCode128B(value);
  } catch {
    return (
      <p className="font-mono text-sm font-bold tracking-widest text-black">{value}</p>
    );
  }

  const pxWidth = encoding.totalModules * moduleWidth;

  return (
    <div className="flex flex-col items-start gap-1">
      <svg
        width={pxWidth}
        height={height}
        viewBox={`0 0 ${encoding.totalModules} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Barcode for order ${value}`}
        shapeRendering="crispEdges"
        className="max-w-full"
      >
        <rect x={0} y={0} width={encoding.totalModules} height={height} fill="#ffffff" />
        {encoding.bars.map((bar, index) => (
          <rect
            key={index}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ))}
      </svg>
      {showText ? (
        <span className="font-mono text-xs font-semibold tracking-[0.2em] text-black">
          {value}
        </span>
      ) : null}
    </div>
  );
}
