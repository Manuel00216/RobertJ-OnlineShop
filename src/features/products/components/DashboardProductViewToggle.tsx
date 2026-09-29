"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Grid/List view toggle for the Products dashboard (Seller and Admin share
 * this one component unchanged). Same visual pattern as the buyer catalog's
 * `ProductFilters` toggle (`LayoutGrid`/`List` icons, segmented pill,
 * `aria-pressed`), but with an inverted default: the dashboard's existing
 * table is `list`, so absence of `?view=` (or an explicit `?view=list`)
 * means list — only `?view=grid` switches to the card grid. Toggling back
 * to List removes the param entirely rather than writing `view=list`, so
 * the URL stays clean and matches "no param = list" exactly.
 */
export function DashboardProductViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "grid" ? "grid" : "list";

  function setView(next: "grid" | "list") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "grid") params.set("view", "grid");
    else params.delete("view");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex shrink-0 overflow-hidden rounded-full border border-border"
      role="group"
      aria-label="Layout"
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        aria-label="Grid view"
        onClick={() => setView("grid")}
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        aria-label="List view"
        onClick={() => setView("list")}
        className={`flex h-9 w-9 items-center justify-center transition-colors ${
          view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
