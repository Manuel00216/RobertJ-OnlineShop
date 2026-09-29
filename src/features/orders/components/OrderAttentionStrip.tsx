"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export interface OrderAttentionStripProps {
  needsConfirmation: number;
  codAwaitingCollection: number;
}

/**
 * Summary strip surfaced above the Orders table — "N orders need
 * confirmation / N COD deliveries awaiting cash collection" — so the count
 * is visible without first toggling a filter. Its own button just sets
 * `attentionOnly` in the URL (the same param `DashboardOrdersPanel` reads),
 * so toggling it re-triggers the server fetch.
 */
export function OrderAttentionStrip({ needsConfirmation, codAwaitingCollection }: OrderAttentionStripProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (needsConfirmation === 0 && codAwaitingCollection === 0) return null;

  const active = searchParams.get("attentionOnly") === "true";

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete("attentionOnly");
    else params.set("attentionOnly", "true");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const parts: string[] = [];
  if (needsConfirmation > 0) {
    parts.push(`${needsConfirmation} order${needsConfirmation === 1 ? "" : "s"} need${needsConfirmation === 1 ? "s" : ""} confirmation`);
  }
  if (codAwaitingCollection > 0) {
    const noun = codAwaitingCollection === 1 ? "delivery" : "deliveries";
    parts.push(`${codAwaitingCollection} COD ${noun} awaiting cash collection`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
      <span aria-hidden="true">⚠</span>
      <p className="flex-1 text-sm font-semibold text-foreground">{parts.join(" · ")}</p>
      <Button type="button" variant="outline" size="rjSm" onClick={toggle}>
        {active ? "Show all orders" : "Show only these"}
      </Button>
    </div>
  );
}
