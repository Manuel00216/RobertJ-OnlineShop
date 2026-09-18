import Link from "next/link";
import type { ReactNode } from "react";

export interface StatCardProps {
  /** Wraps the tile in a Link when provided (Admin/Seller KPI rows). Omitted = a plain, non-clickable tile (Reports). */
  href?: string;
  label: string;
  value: ReactNode;
  /** Icon chip — all three of icon/iconBg/iconColor are needed together to render it. Omitted = no icon (Reports). */
  icon?: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  iconColor?: string;
  /** Optional secondary line under the label — e.g. "Paid orders only". */
  hint?: string;
}

/**
 * Shared KPI/metric tile — used by the Admin and Seller dashboards' KPI rows
 * (icon chip, Link-wrapped) and the Reports sales summary (no icon, no link).
 * Theme-aware (generic tokens only), so it repaints correctly under the
 * Admin/Seller dark-mode toggle.
 */
export function StatCard({ href, label, value, icon: Icon, iconBg, iconColor, hint }: StatCardProps) {
  const body = (
    <div className="h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      {Icon ? (
        <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
        </div>
      ) : null}
      <div className="mb-1 truncate text-2xl font-semibold leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
