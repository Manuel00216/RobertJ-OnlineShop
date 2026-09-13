"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { RecommendationRule } from "@/features/assistant";
import { DashboardProductRow } from "@/features/products/components/DashboardProductRow";
import { ProductForm } from "@/features/products/components/ProductForm";
import type { Category } from "@/features/categories/types/category.types";
import type { Product, ProductVariant } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";

export interface DashboardProductsPanelProps {
  products: Product[];
  categories: Category[];
  /** Populated only for an admin (from `listShops()`); empty for a seller. */
  shops: Shop[];
  isAdmin: boolean;
  /** Every variant visible to the caller, one bulk fetch — filtered per row below, no N+1. */
  variants: ProductVariant[];
  /** Every Guided Selection rule visible to the caller, one bulk fetch — filtered per row below, no N+1. */
  rules: RecommendationRule[];
}

/**
 * Client wrapper for the products management list: owns the "show create
 * form" toggle (seller-only — admin creates nothing, see `createProductAction`)
 * and renders the management list. Data (`products`/`categories`/`shops`) is
 * fetched once, server-side, by the page — this component does no fetching
 * of its own.
 */
export function DashboardProductsPanel({
  products,
  categories,
  shops,
  isAdmin,
  variants,
  rules,
}: DashboardProductsPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-rj-gray-600">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
        {/* Admin manages/moderates existing products only — never creates
            one, so this action (and the form below) is seller-only. */}
        {!isAdmin ? (
          <Button
            type="button"
            variant="rj"
            size="rjSm"
            onClick={() => setShowCreateForm((value) => !value)}
          >
            {showCreateForm ? "Cancel" : "New product"}
          </Button>
        ) : null}
      </div>

      {!isAdmin && showCreateForm ? (
        <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
          <ProductForm categories={categories} onDone={() => setShowCreateForm(false)} />
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
              variants={variants.filter((variant) => variant.productId === product.id)}
              rules={rules.filter((rule) => rule.productId === product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
