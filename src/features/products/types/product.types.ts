import type { ProductCondition, ProductStatus } from "@/constants/status";

/** One image belonging to a product, ordered by `sortOrder` (0 is the cover). */
export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

/** Domain model returned by the product service to the rest of the app. */
export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantity: number;
  condition: ProductCondition;
  status: ProductStatus;
  featured: boolean;
  location: string | null;
  tags: string[];
  images: ProductImage[];
  categoryId: string | null;
  /** Category display name from the joined categories row, or null. */
  categoryName: string | null;
  /** Category slug from the joined categories row (for linking), or null. */
  categorySlug: string | null;
  sellerId: string;
  /** Seller's display name (full name, falling back to username), or null. */
  sellerName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filters accepted by the product listing query. */
export interface ProductListParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  sellerId?: string;
  sort?: ProductSort;
  /** Matches products tagged "sale" — the same seller-set tag convention ProductCard already reads. */
  onSale?: boolean;
}

export type ProductSort = "newest" | "price-asc" | "price-desc" | "title-asc";

/** Convenience accessor — the cover image, or null when a product has none. */
export function getCoverImage(product: Product): ProductImage | null {
  return product.images[0] ?? null;
}
