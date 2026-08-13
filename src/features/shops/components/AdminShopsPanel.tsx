"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ShopForm } from "@/features/shops/components/ShopForm";
import { ShopRow } from "@/features/shops/components/ShopRow";
import type { ShopWithMember } from "@/features/shops/types/shop.types";

export interface AdminShopsPanelProps {
  shops: ShopWithMember[];
}

/** `/dashboard/shops`'s list — mirrors `DashboardProductsPanel`'s exact shape (a "New shop" toggle + one row per shop). */
export function AdminShopsPanel({ shops }: AdminShopsPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-rj-gray-600">
          {shops.length} shop{shops.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant="rj"
          size="rjSm"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          {showCreateForm ? "Cancel" : "New shop"}
        </Button>
      </div>

      {showCreateForm ? (
        <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
          <ShopForm onDone={() => setShowCreateForm(false)} />
        </div>
      ) : null}

      {shops.length === 0 ? (
        <EmptyState
          title="No shops yet"
          description="Create the first shop to start onboarding sellers."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {shops.map((shop) => (
            <ShopRow key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}
