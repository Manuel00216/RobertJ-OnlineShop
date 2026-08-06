"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/**
 * Keeps the `search` query param in sync with a debounced Order-ID input.
 * Clears `page` so a search always restarts from page 1.
 */
export function OrderSearchInput() {
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
      <label htmlFor="order-search" className="sr-only">
        Search by order number
      </label>
      <input
        id="order-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by Order ID…"
        className="h-11 w-full rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-5 text-sm text-rj-black outline-none transition-colors placeholder:text-rj-gray-400 focus-visible:border-rj-black"
      />
    </div>
  );
}
