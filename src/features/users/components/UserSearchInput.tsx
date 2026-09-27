"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/**
 * Keeps the `search` query param in sync with a debounced name/username/email
 * input. Clears `page` so a search always restarts from page 1 — mirrors
 * `OrderSearchInput`'s shape, themed for the Admin Portal.
 */
export function UserSearchInput() {
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
    <div className="w-full max-w-sm">
      <label htmlFor="user-search" className="sr-only">
        Search users by name or email
      </label>
      <input
        id="user-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name or email…"
        className="h-11 w-full rounded-full border-[1.5px] border-border bg-transparent px-5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </div>
  );
}
