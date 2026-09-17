"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export interface PaginationControlsProps {
  page: number;
  totalPages: number;
  /** Renders through the Admin/Seller portal's tokens instead of the fixed rj-* palette — pass from portal listings (DashboardOrdersPanel) only; Buyer product/order listings omit it. */
  themed?: boolean;
}

/** Builds a windowed page list: 1 … (page±1) … last, with ellipsis markers. */
function buildPages(page: number, totalPages: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  const push = (value: number | "…") => {
    if (out[out.length - 1] !== value) out.push(value);
  };

  push(1);
  if (page > 3) push("…");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p += 1) {
    push(p);
  }
  if (page < totalPages - 2) push("…");
  if (totalPages > 1) push(totalPages);

  return out;
}

const PAGE_ACTIVE =
  "flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-rj-black bg-rj-black text-[11px] font-bold text-rj-white";
const PAGE_IDLE =
  "flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-rj-gray-200 bg-transparent text-[11px] font-bold text-rj-gray-600 transition-all hover:border-rj-black hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";
const PAGE_ACTIVE_THEMED =
  "flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-primary bg-primary text-[11px] font-bold text-primary-foreground";
const PAGE_IDLE_THEMED =
  "flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-border bg-transparent text-[11px] font-bold text-muted-foreground transition-all hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/** Prev/next + windowed page numbers. Keeps every other filter in the URL. `themed`: see PaginationControlsProps. */
export function PaginationControls({ page, totalPages, themed = false }: PaginationControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(pageNumber: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNumber));
    return `${pathname}?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const accent = themed ? "text-primary" : "text-rj-red-dark";
  const faint = themed ? "text-muted-foreground" : "text-rj-gray-400";
  const ring = themed ? "focus-visible:ring-ring/30" : "focus-visible:ring-rj-red/30";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      {hasPrev ? (
        <Link
          href={hrefFor(page - 1)}
          className={cn("text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2", accent, ring)}
        >
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={cn("text-xs font-semibold", faint)}>
          Previous
        </span>
      )}

      <ul className="flex items-center gap-1.5">
        {buildPages(page, totalPages).map((value, index) =>
          value === "…" ? (
            <li key={`ellipsis-${index}`}>
              <span aria-hidden="true" className={cn("px-1", faint)}>
                …
              </span>
            </li>
          ) : (
            <li key={value}>
              {value === page ? (
                <span aria-current="page" className={themed ? PAGE_ACTIVE_THEMED : PAGE_ACTIVE}>
                  {value}
                </span>
              ) : (
                <Link href={hrefFor(value)} className={themed ? PAGE_IDLE_THEMED : PAGE_IDLE}>
                  {value}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {hasNext ? (
        <Link
          href={hrefFor(page + 1)}
          className={cn("text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2", accent, ring)}
        >
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={cn("text-xs font-semibold", faint)}>
          Next
        </span>
      )}
    </nav>
  );
}
