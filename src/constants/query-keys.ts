import type { ProductListParams } from "@/features/products/types/product.types";

/** Centralised TanStack Query keys so caches invalidate consistently. */
export const QUERY_KEYS = {
  products: {
    all: ["products"] as const,
    list: (params: ProductListParams) => ["products", "list", params] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  orders: {
    all: ["orders"] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
} as const;
