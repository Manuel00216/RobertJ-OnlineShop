"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Keeps the `search` query param in sync with a debounced order-number search — mirrors `OrderSearchInput`'s exact pattern for the Payments dashboard table. */
export function PaymentSearchInput() {
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
      <label htmlFor="payment-search" className="sr-only">
        Search by order number
      </label>
      <input
        id="payment-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by Order ID…"
        className="h-11 w-full rounded-full border-[1.5px] border-border bg-transparent px-5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary"
      />
    </div>
  );
}
