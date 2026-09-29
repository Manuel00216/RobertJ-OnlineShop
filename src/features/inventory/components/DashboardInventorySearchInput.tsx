"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Keeps the `search` query param in sync with a debounced product-title search — mirrors `OrderSearchInput`'s exact pattern for the Inventory dashboard table. */
export function DashboardInventorySearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const debounced = useDebouncedValue(value, 350);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("search") ?? "";
    if (current === debounced) return;

    if (debounced) {
      params.set("search", debounced);
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debounced, pathname, router, searchParams]);

  return (
    <div className="relative w-full max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <label htmlFor="dashboard-inventory-search" className="sr-only">
        Search by product name
      </label>
      <input
        id="dashboard-inventory-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by product name…"
        className="h-9 w-full rounded-full border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </div>
  );
}
