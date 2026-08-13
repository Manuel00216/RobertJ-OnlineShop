"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { DashboardProductRow } from "@/features/products/components/DashboardProductRow";
import { ProductForm } from "@/features/products/components/ProductForm";
import type { Category } from "@/features/categories/types/category.types";
import type { Product } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";

export interface DashboardProductsPanelProps {
  products: Product[];
  categories: Category[];
  /** Populated only for an admin (from `listShops()`); empty for a seller. */
  shops: Shop[];
  isAdmin: boolean;
}

/**
 * Client wrapper for `/dashboard/products`: owns the "show create form"
 * toggle and renders the management list. Data (`products`/`categories`/
 * `shops`) is fetched once, server-side, by the page — this component does
 * no fetching of its own.
 */
export function DashboardProductsPanel({
  products,
  categories,
  shops,
  isAdmin,
}: DashboardProductsPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-rj-gray-600">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant="rj"
          size="rjSm"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          {showCreateForm ? "Cancel" : "New product"}
        </Button>
      </div>

      {showCreateForm ? (
        <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
          <ProductForm
            categories={categories}
            shops={isAdmin ? shops : undefined}
            onDone={() => setShowCreateForm(false)}
          />
        </div>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Create your first product to get started."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <DashboardProductRow
              key={product.id}
              product={product}
              categories={categories}
              shops={shops}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
