"use client";

import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RJ_CARD, THEMED_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { OrderItem } from "@/features/orders/types/order.types";

export interface ItemVerificationChecklistProps {
  items: OrderItem[];
  isPending: boolean;
  themed?: boolean;
  /** Called once every line has been checked and the seller confirms. */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The To Pack → Ready for Pickup gate: the seller ticks off every line
 * (product + variant + quantity) before the order can advance. Purely a
 * client-side transition gate — which lines were ticked is never stored; only
 * a `packed_at` audit timestamp is recorded server-side once the transition
 * succeeds. No warehouse-management, no per-item records.
 */
export function ItemVerificationChecklist({
  items,
  isPending,
  themed = false,
  onConfirm,
  onCancel,
}: ItemVerificationChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = items.length > 0 && items.every((item) => checked[item.id]);
  const ink = themed ? "text-foreground" : "text-rj-black";
  const muted = themed ? "text-muted-foreground" : "text-rj-gray-600";

  return (
    <section
      aria-label="Verify items before packing"
      className={cn(themed ? THEMED_CARD : RJ_CARD, "flex flex-col gap-4 p-5")}
    >
      <div>
        <h3 className={cn("text-sm font-bold", ink)}>Verify items before packing</h3>
        <p className={cn("mt-1 text-xs", muted)}>
          Confirm every item is packed. All items must be checked to mark this order ready for pickup.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                themed ? "border-border" : "border-rj-gray-200",
              )}
            >
              <Checkbox
                checked={checked[item.id] ?? false}
                onChange={(event) =>
                  setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))
                }
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", ink)}>
                  {item.productTitle}
                </span>
                <span className={cn("block text-xs", muted)}>
                  {item.variantLabel ? `${item.variantLabel} · ` : ""}
                  Qty {item.quantity}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="rjSm"
          isLoading={isPending}
          disabled={!allChecked}
          onClick={onConfirm}
        >
          Mark ready for pickup
        </Button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "rjSm" }))}
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
