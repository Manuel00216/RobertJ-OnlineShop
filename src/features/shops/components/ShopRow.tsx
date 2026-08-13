"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { toggleShopActiveAction } from "@/features/shops/actions/shop.actions";
import { ShopForm } from "@/features/shops/components/ShopForm";
import type { ShopWithMember } from "@/features/shops/types/shop.types";

export interface ShopRowProps {
  shop: ShopWithMember;
}

/** One shop in the admin management list. Edit swaps the row for an inline `ShopForm`, mirrors `DashboardProductRow`. */
export function ShopRow({ shop }: ShopRowProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (mode === "edit") {
    return (
      <Card className="border-rj-gray-100">
        <CardContent className="p-5">
          <ShopForm shop={shop} onDone={() => setMode("view")} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setMode("view")}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await toggleShopActiveAction(shop.id, !shop.active);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-rj-black">{shop.name}</p>
            <Badge tone={shop.active ? "success" : "neutral"}>
              {shop.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-rj-gray-600">
            {shop.memberName ?? "Unassigned"} · /{shop.slug}
          </p>
          {error ? (
            <div className="mt-2">
              <ErrorState title="Something went wrong" message={error} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("edit")}>
            Edit
          </Button>
          <Button
            type="button"
            variant={shop.active ? "danger" : "rj"}
            size="sm"
            isLoading={isPending}
            onClick={handleToggleActive}
          >
            {shop.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
