import "server-only";

import { cache } from "react";
import type { UserIdentity } from "@supabase/supabase-js";

import { USER_ROLES, type UserRole } from "@/constants/roles";
import { publicEnv } from "@/config/env";
import { DATABASE_TABLES } from "@/constants/database";
import { ROUTES } from "@/constants/routes";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  type OrderStatus,
  type ProductCondition,
  type ProductStatus,
} from "@/constants/status";
import {
  createSupabaseAdminClient,
  createSupabaseAnonClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { mapPostgresError } from "@/lib/supabase/postgres-errors";
import type { Database, Json } from "@/lib/supabase/database.types";
import { slugify } from "@/lib/utils/format";
import { toCents } from "@/lib/utils/currency";
import { toRange, type PaginatedResult } from "@/types/pagination.types";
import type { SessionUser } from "@/types/common.types";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/features/products/schemas/product.schema";
import type {
  Product,
  ProductImage,
  ProductListParams,
} from "@/features/products/types/product.types";
import type { Category } from "@/features/categories/types/category.types";
import type { LandingStat } from "@/features/landing/types/landing.types";
import {
  CANCELLABLE_ORDER_STATUSES,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_TRANSITIONS,
  getOrderStatusLabel,
} from "@/features/orders/constants/order.constants";
import type {
  Order,
  OrderListParams,
  OrderSummary,
  ShippingAddress,
} from "@/features/orders/types/order.types";
import type { UpdateProfileInput } from "@/features/account/schemas/account.schema";
import type { OAuthProvider } from "@/features/auth/schemas/auth.schema";
import type { Profile } from "@/features/account/types/account.types";
import type { Payment, PaymentDecision } from "@/features/payments/types/payment.types";
import type { Shop, ShopWithMember } from "@/features/shops/types/shop.types";
import type { AdminUser } from "@/features/users/types/user.types";
import type { AdjustStockInput } from "@/features/inventory/schemas/inventory.schema";
import {
  getStockStatus,
  type InventoryItem,
  type StockAdjustment,
} from "@/features/inventory/types/inventory.types";
import type {
  OrderStatusCount,
  ReportGranularity,
  SalesSummary,
  SalesTrendPoint,
  TopProduct,
} from "@/features/reports/types/report.types";
import type {
  ProductReviewSummary,
  Review,
} from "@/features/reviews/types/review.types";
import type { BuyerActivityEvent } from "@/features/notifications/types/notification.types";

/**
 * Centralized, reusable Supabase data-access layer.
 *
 * Every query the app makes against the database lives in this one file, so
 * there is a single place to look when tracing what a feature reads or writes.
 * Callers (Server Components, Server Actions) import the functions they need —
 * nothing here is feature-specific, and every function is safe to reuse from
 * any feature. The connection itself is still centralized one level further
 * down, in `lib/supabase/{server,client,session}.ts`; this file is the layer
 * above that turns raw Supabase calls into typed, reusable query functions.
 *
 * Organized in sections: Products, Categories, Landing stats, Auth/session.
 */

// ============================================================================
// Products
// ============================================================================

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * `search_vector` is deliberately excluded: it is a generated tsvector that has
 * no client-side use and would bloat every payload. The seller profile is
 * embedded so the UI can show the shop/seller name without a second query.
 *
 * Table names here are intentionally literal, not `DATABASE_TABLES.X` /
 * `embed(...)`: Supabase's generated types parse this exact string at the type
 * level to infer the joined row shape, and that parser only works against a
 * literal template — interpolating a constant widens it to `string` and the
 * inferred type collapses to an untyped fallback. `DATABASE_TABLES` is used
 * everywhere else in this file (every `.from()` / `.eq()` call below); this
 * `.select()` string is the one documented exception.
 */
const PRODUCT_COLUMNS = `
  id, slug, title, description, price_cents, currency, quantity, condition,
  status, featured, location, tags, category_id, seller_id, shop_id, published_at,
  created_at, updated_at,
  product_images ( id, url, alt_text, sort_order ),
  seller:profiles!products_seller_id_fkey ( full_name, username, role ),
  category:categories!products_category_id_fkey ( name, slug )
`;

type ProductRowWithImages = Omit<ProductRow, "search_vector"> & {
  product_images: Pick<
    ProductImageRow,
    "id" | "url" | "alt_text" | "sort_order"
  >[];
  seller: Pick<ProfileRow, "full_name" | "username" | "role"> | null;
  category: { name: string; slug: string } | null;
};

/** Maps a database row onto the domain model the app consumes. */
function toProduct(row: ProductRowWithImages): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    quantity: row.quantity,
    condition: row.condition as ProductCondition,
    status: row.status as ProductStatus,
    featured: row.featured,
    location: row.location,
    tags: row.tags,
    images: [...(row.product_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.alt_text,
        sortOrder: image.sort_order,
      })),
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    sellerId: row.seller_id,
    sellerName: row.seller?.full_name ?? row.seller?.username ?? null,
    // Only a genuine `seller` is ever a shop owner — a product whose
    // `seller_id` resolves to an admin or (legacy/demoted) buyer profile has
    // no shop to display, and showing that account's personal name in its
    // place would be misleading, not just unbranded. Callers that render a
    // "shop" label check this before falling back to `sellerName`.
    sellerRole: (row.seller?.role as UserRole | undefined) ?? null,
    shopId: row.shop_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Paginated, filtered product listing. */
export async function listProducts(
  params: ProductListParams,
): Promise<PaginatedResult<Product>> {
  const supabase = await createSupabaseServerClient();

  // `shopId` isn't a column on `products` (TD-1 — `products.shop_id` is
  // unpopulated on every live row) — resolve it to the shop's member seller
  // ids first via `resolve_shop_membership`, same as the dedicated shop
  // filter. A shop with zero members short-circuits to an empty page instead
  // of querying products at all.
  let shopSellerIds: string[] | null = null;
  if (params.shopId) {
    shopSellerIds = await getShopSellerIds(params.shopId);
    if (shopSellerIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: 1,
      };
    }
  }

  let query = supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("status", params.status ?? PRODUCT_STATUS.active);

  if (shopSellerIds) {
    query = query.in("seller_id", shopSellerIds);
  }

  if (params.search) {
    // Postgres's `.or()` filter mini-DSL treats "," and "()" as syntax, not
    // literal characters, so strip them before interpolating — otherwise a
    // search term containing one would break the filter string.
    const term = params.search.replace(/[,()]/g, " ").trim();
    if (term) {
      // Trigram substring match on the title (typo/partial-tolerant, backed
      // by products_title_trgm_idx) OR'd with full-text search across the
      // generated `search_vector` column (title + description, backed by
      // products_search_vector_idx — see initial_schema.sql), so a
      // description-only match is now findable too.
      query = query.or(
        `title.ilike.%${term}%,search_vector.wfts(english).${term}`,
      );
    }
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.onSale) {
    // Same seller-set "sale" tag convention ProductCard/FeaturedProductsGrid
    // already read — no compare-at-price column exists to filter on instead.
    query = query.contains("tags", ["sale"]);
  }
  if (params.sellerId) {
    query = query.eq("seller_id", params.sellerId);
  }
  if (params.minPrice !== undefined) {
    // Backed by products_active_price_idx (price_cents where status='active').
    query = query.gte("price_cents", toCents(params.minPrice));
  }
  if (params.maxPrice !== undefined) {
    query = query.lte("price_cents", toCents(params.maxPrice));
  }

  switch (params.sort) {
    case "price-asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "title-asc":
      query = query.order("title", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { from, to } = toRange(params);
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => toProduct(row as ProductRowWithImages)),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/**
 * Featured products for the landing page: active listings flagged `featured`,
 * newest first. Returns an empty array when nothing is featured yet, so the
 * section can render a placeholder instead of failing.
 */
export async function listFeaturedProducts(limit = 8): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select(PRODUCT_COLUMNS)
    .eq("status", PRODUCT_STATUS.active)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load featured products: ${error.message}`);
  }

  return (data ?? []).map((row) => toProduct(row as ProductRowWithImages));
}

/**
 * Single product lookup by public slug. Returns null when not found.
 * `cache()`d so `generateMetadata` and the page share one fetch per request.
 */
export const getProductBySlug = cache(
  async (slug: string): Promise<Product | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(DATABASE_TABLES.PRODUCTS)
      .select(PRODUCT_COLUMNS)
      .eq("slug", slug)
      .eq("status", PRODUCT_STATUS.active)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load product: ${error.message}`);
    }

    return data ? toProduct(data as ProductRowWithImages) : null;
  },
);

/**
 * Related products for a detail page: same category, active, excluding the
 * product itself, newest first. Returns `[]` when the product has no category.
 */
export async function listRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  if (!product.categoryId) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select(PRODUCT_COLUMNS)
    .eq("status", PRODUCT_STATUS.active)
    .eq("category_id", product.categoryId)
    .neq("id", product.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load related products: ${error.message}`);
  }

  return (data ?? []).map((row) => toProduct(row as ProductRowWithImages));
}

export interface ProductSuggestion {
  id: string;
  title: string;
  slug: string;
}

/**
 * Lightweight title-only matches for the header search's suggestions
 * dropdown. Deliberately not the full `listProducts` search (no
 * description/full-text match, no pagination) — this only needs to be fast
 * and narrow. Never triggers navigation itself; the header decides what to
 * do with a click.
 */
export async function searchProductSuggestions(
  term: string,
  limit = 5,
): Promise<ProductSuggestion[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select("id, title, slug")
    .eq("status", PRODUCT_STATUS.active)
    .ilike("title", `%${trimmed.replace(/[%_]/g, "")}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }
  return data ?? [];
}

/** Live price/stock snapshot for one product, used to revalidate a cached cart line. */
export interface ProductPriceAndStock {
  id: string;
  priceCents: number;
  quantity: number;
  status: ProductStatus;
}

/**
 * Batch re-check of current price/stock/status for a set of product ids — the
 * read-side counterpart to `create_order`'s re-pricing, used to flag stale
 * cart lines before checkout. Public (no auth): the cart is a guest-accessible
 * client-side feature (ADR-013), so this must work without a session.
 *
 * The `products` SELECT RLS policy scopes anonymous/non-owner reads to
 * `status = 'active'` (see initial_schema.sql), so a product that has sold
 * out, been archived, or gone back to draft simply will not come back in the
 * result set — callers must treat an id **missing** from the returned array
 * as "no longer available," not as a fetch bug.
 */
export async function getProductsPriceAndStock(
  ids: string[],
): Promise<ProductPriceAndStock[]> {
  if (ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select("id, price_cents, quantity, status")
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to check product availability: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    priceCents: row.price_cents,
    quantity: row.quantity,
    status: row.status as ProductStatus,
  }));
}

/**
 * Slug + last-modified for every active product, for `sitemap.ts` only.
 * Uses the cookie-free `createSupabaseAnonClient()` (not the usual
 * cookie-bound client) so the sitemap route stays static/ISR-eligible — see
 * that function's doc comment.
 */
export async function listActiveProductSlugsForSitemap(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select("slug, updated_at")
    .eq("status", PRODUCT_STATUS.active);

  if (error) {
    throw new Error(`Failed to load product slugs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
}

/**
 * Inserts a product owned by the given seller, in the given shop. `shopId`
 * is always a server-resolved value (the caller's own shop via
 * `requireOwnShopId()`, or an admin's explicit selection from `listShops()`)
 * — never taken from `input.shopId` directly, so a client can't submit an
 * arbitrary shop even though RLS would reject a mismatched one anyway.
 */
export async function createProduct(
  input: CreateProductInput,
  sellerId: string,
  shopId: string,
): Promise<Product> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .insert({
      slug: `${slugify(input.title)}-${Date.now().toString(36)}`,
      title: input.title,
      description: input.description ?? null,
      price_cents: toCents(input.price),
      quantity: input.quantity,
      condition: input.condition,
      status: input.status,
      location: input.location ?? null,
      tags: input.tags,
      category_id: input.categoryId ?? null,
      seller_id: sellerId,
      shop_id: shopId,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  return toProduct(data as ProductRowWithImages);
}

/**
 * Applies a partial update. RLS enforces seller ownership.
 *
 * `quantity` is handled separately: `products.quantity` is a trigger-synced
 * mirror of `inventory.quantity` (see the Inventory module's migration), and
 * `authenticated` no longer has UPDATE privilege on that column directly. A
 * submitted `quantity` is converted to a delta against the current stock and
 * routed through `adjustStock()` — the audited, authorization-checked RPC —
 * *before* the rest of the row is updated, so a partial failure never leaves
 * stock silently wrong while cosmetic fields succeed.
 */
/**
 * `owner`: the caller's own scope for a non-admin request (`null` = admin,
 * no extra filter — RLS's `is_admin()` is already the complete boundary
 * there). For a seller, mirrors the live RLS policy exactly: their own
 * products, or any product belonging to a shop they're a member of.
 * Defense-in-depth alongside RLS, not a replacement for it — see the
 * 2026-08-20 audit (this table's UPDATE previously relied on RLS alone).
 */
export async function updateProduct(
  input: UpdateProductInput,
  owner: { sellerId: string; shopId: string | null } | null,
): Promise<Product> {
  const supabase = await createSupabaseServerClient();
  const { id, price, categoryId, description, location, quantity, ...rest } = input;

  if (owner) {
    const ownerFilter = owner.shopId
      ? `seller_id.eq.${owner.sellerId},shop_id.eq.${owner.shopId}`
      : `seller_id.eq.${owner.sellerId}`;
    const { data: existing, error: readError } = await supabase
      .from(DATABASE_TABLES.PRODUCTS)
      .select("id")
      .eq("id", id)
      .or(ownerFilter)
      .maybeSingle();

    if (readError) {
      throw new Error(`Failed to load product: ${readError.message}`);
    }
    if (!existing) {
      throw new Error("Product not found.");
    }
  }

  if (quantity !== undefined) {
    const current = await getInventoryForProduct(id);
    const delta = quantity - (current?.quantity ?? 0);
    if (delta !== 0) {
      await adjustStock({ productId: id, delta, reason: "correction" });
    }
  }

  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .update({
      ...rest,
      ...(description !== undefined ? { description: description || null } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
      ...(price !== undefined ? { price_cents: toCents(price) } : {}),
      ...(categoryId !== undefined ? { category_id: categoryId ?? null } : {}),
    })
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }

  return toProduct(data as ProductRowWithImages);
}

/**
 * Soft delete: archived products stay queryable so historical order items keep
 * resolving. The order_items -> products FK is ON DELETE RESTRICT for the same
 * reason, so a hard delete of a sold product is refused by the database.
 */
/** `owner`: same defense-in-depth scope as `updateProduct` above. */
export async function archiveProduct(
  id: string,
  owner: { sellerId: string; shopId: string | null } | null,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  if (owner) {
    const ownerFilter = owner.shopId
      ? `seller_id.eq.${owner.sellerId},shop_id.eq.${owner.shopId}`
      : `seller_id.eq.${owner.sellerId}`;
    const { data: existing, error: readError } = await supabase
      .from(DATABASE_TABLES.PRODUCTS)
      .select("id")
      .eq("id", id)
      .or(ownerFilter)
      .maybeSingle();

    if (readError) {
      throw new Error(`Failed to load product: ${readError.message}`);
    }
    if (!existing) {
      throw new Error("Product not found.");
    }
  }

  const { error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .update({ status: PRODUCT_STATUS.archived })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive product: ${error.message}`);
  }
}

/**
 * Cheap ownership check for a seller before an image write — mirrors the
 * `product_images` RLS policies' own `p.seller_id = auth.uid()` check
 * (no `shopId` clause: unlike `products`, `product_images` RLS was never
 * shop-aware, so there's nothing to gain by checking shop membership here).
 */
export async function productBelongsToSeller(
  productId: string,
  sellerId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select("id")
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify product ownership: ${error.message}`);
  }
  return Boolean(data);
}

/**
 * Uploads one product photo to the public `product-images` bucket and
 * returns its public URL — mirrors `uploadPaymentReceipt`'s path convention
 * (`{parent_id}/{uuid}.{ext}`), except this bucket is public (product photos
 * must be visible to guests) so the URL, not a private path, is what
 * `product_images.url` stores (see the `product_images_url_scheme` check
 * constraint, which requires a full `https?://` value).
 */
export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Attaches an already-uploaded image to a product. `sort_order` is
 * server-computed (one past the current max) so callers never have to track
 * ordering themselves, respecting the `unique (product_id, sort_order)`
 * constraint without a client-supplied index that could collide.
 */
export async function addProductImage(
  productId: string,
  url: string,
): Promise<ProductImage> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from(DATABASE_TABLES.PRODUCT_IMAGES)
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to load existing images: ${readError.message}`);
  }

  const nextSortOrder = existing ? existing.sort_order + 1 : 0;

  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCT_IMAGES)
    .insert({ product_id: productId, url, sort_order: nextSortOrder })
    .select("id, url, alt_text, sort_order")
    .single();

  if (error) {
    throw new Error(`Failed to save image: ${error.message}`);
  }

  return {
    id: data.id,
    url: data.url,
    altText: data.alt_text,
    sortOrder: data.sort_order,
  };
}

/**
 * Removes a product image row and its Storage object.
 * `owner`: same defense-in-depth scope as `updateProduct`/`archiveProduct`
 * (`null` = admin, RLS is the complete boundary; otherwise re-verify the
 * image's parent product belongs to this seller before deleting anything).
 */
export async function deleteProductImage(
  imageId: string,
  owner: { sellerId: string } | null,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: image, error: readError } = await supabase
    .from(DATABASE_TABLES.PRODUCT_IMAGES)
    .select("id, url, product_id, products!inner ( seller_id )")
    .eq("id", imageId)
    .maybeSingle<{
      id: string;
      url: string;
      product_id: string;
      products: { seller_id: string };
    }>();

  if (readError) {
    throw new Error(`Failed to load image: ${readError.message}`);
  }
  if (!image) {
    throw new Error("Image not found.");
  }
  if (owner && image.products.seller_id !== owner.sellerId) {
    throw new Error("Image not found.");
  }

  const { error: deleteError } = await supabase
    .from(DATABASE_TABLES.PRODUCT_IMAGES)
    .delete()
    .eq("id", imageId);

  if (deleteError) {
    throw new Error(`Failed to delete image: ${deleteError.message}`);
  }

  const path = new URL(image.url).pathname.split("/product-images/")[1];
  if (path) {
    await supabase.storage.from("product-images").remove([path]);
  }
}

// ============================================================================
// Wishlist
// ============================================================================

/** Ids of every product the given user has saved — a cheap bulk check so a
 * listing/grid page can mark hearts as filled without one query per tile. */
export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .select("product_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load wishlist: ${error.message}`);
  }
  return (data ?? []).map((row) => row.product_id);
}

/** Whether the given user has saved one specific product — used on the PDP. */
export async function isProductWishlisted(
  userId: string,
  productId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check wishlist: ${error.message}`);
  }
  return data !== null;
}

/**
 * The signed-in user's saved products, newest-saved first, for the
 * `/wishlist` page. Fetched as two plain, literal-select queries (rather than
 * one embedded `wishlists -> products` join) so the `PRODUCT_COLUMNS` select
 * string stays a direct, uninterpolated literal — the one form Supabase's
 * generated-type parser can actually infer (see the comment above
 * `PRODUCT_COLUMNS`).
 */
export async function listWishlistProducts(userId: string): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();

  const { data: wishlistRows, error: wishlistError } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (wishlistError) {
    throw new Error(`Failed to load wishlist: ${wishlistError.message}`);
  }

  const orderedIds = (wishlistRows ?? []).map((row) => row.product_id);
  if (orderedIds.length === 0) return [];

  const { data: productRows, error: productsError } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select(PRODUCT_COLUMNS)
    .in("id", orderedIds);

  if (productsError) {
    throw new Error(`Failed to load wishlist: ${productsError.message}`);
  }

  // `.in()` does not preserve argument order, and RLS silently omits a
  // product that's no longer `active` (and not the caller's own) — resort to
  // the wishlist's own saved-order and drop whatever didn't come back rather
  // than surfacing a "missing product" error for a legitimately sold-out item.
  const byId = new Map(
    (productRows ?? []).map((row) => [
      row.id,
      toProduct(row as ProductRowWithImages),
    ]),
  );
  return orderedIds
    .map((id) => byId.get(id))
    .filter((product): product is Product => product !== undefined);
}

/**
 * Saves a product to the user's wishlist. Idempotent by design — re-saving
 * an already-saved product (e.g. a duplicate optimistic click) is a silent
 * no-op rather than an error; `wishlists_unique_item` (23505) is the only
 * thing that would otherwise reject it.
 */
export async function addWishlistItem(
  userId: string,
  productId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .insert({ user_id: userId, product_id: productId });

  if (error && error.code !== "23505") {
    throw new Error(mapPostgresError(error, "Could not save this item."));
  }
}

/** Removes a product from the user's wishlist. A no-op if it wasn't saved. */
export async function removeWishlistItem(
  userId: string,
  productId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(mapPostgresError(error, "Could not remove this item."));
  }
}

// ============================================================================
// Reviews
// ============================================================================

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    orderItemId: row.order_item_id,
    productId: row.product_id,
    reviewerDisplayName: row.reviewer_display_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

/**
 * Public reviews for one product, newest first, with a live-computed
 * average — never denormalized onto `products` (see DECISIONS.md ADR-018).
 */
export async function listProductReviews(
  productId: string,
): Promise<ProductReviewSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.REVIEWS)
    .select(
      "id, order_item_id, product_id, buyer_id, reviewer_display_name, rating, comment, created_at",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load reviews: ${error.message}`);
  }

  const reviews = (data ?? []).map((row) => toReview(row as ReviewRow));
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;

  return { reviews, averageRating, reviewCount };
}

/**
 * Submits a verified-purchase review via the `submit_review` RPC, which
 * re-checks ownership + `order_status = 'delivered'` itself — this function
 * never trusts the caller's claim about which order the item belongs to.
 */
export async function submitReview(
  orderItemId: string,
  rating: number,
  comment: string | null,
): Promise<Review> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_review", {
    p_order_item_id: orderItemId,
    p_rating: rating,
    p_comment: comment,
  });

  if (error) {
    throw new Error(mapPostgresError(error, "Could not submit your review."));
  }
  return toReview(data as ReviewRow);
}

/**
 * Which of the given order items already have a review — used to hide
 * "Write a Review" for items the buyer has already covered.
 */
export async function listReviewedOrderItemIds(
  orderItemIds: string[],
): Promise<Set<string>> {
  if (orderItemIds.length === 0) return new Set();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.REVIEWS)
    .select("order_item_id")
    .in("order_item_id", orderItemIds);

  if (error) {
    throw new Error(`Failed to check existing reviews: ${error.message}`);
  }
  return new Set((data ?? []).map((row) => row.order_item_id));
}

// ============================================================================
// Buyer Activity Feed
// ============================================================================

/**
 * Derived, read-only notification feed via `get_buyer_activity_feed` — no
 * `notifications` table, no triggers, no realtime (see DECISIONS.md
 * ADR-018). "Confirmed"/"processing" are not represented: `orders` has no
 * timestamp column for those transitions, and this deliberately doesn't
 * guess one.
 */
export async function getBuyerActivityFeed(
  limit = 20,
): Promise<BuyerActivityEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_buyer_activity_feed", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to load activity: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    eventType: row.event_type as BuyerActivityEvent["eventType"],
    orderId: row.order_id,
    orderNumber: row.order_number,
    occurredAt: row.occurred_at,
  }));
}

// ============================================================================
// Categories
// ============================================================================

/**
 * Category columns plus an aggregate count of the category's active products.
 * The `products(count)` embed is filtered to active listings (see the
 * `products.status` filter on the query), so the label reflects what a shopper
 * can actually buy — drafts and archived rows are excluded.
 */
// Literal for the same reason as PRODUCT_COLUMNS above — this string is parsed
// at the type level by Supabase's generated types and must not be interpolated.
const CATEGORY_COLUMNS = `id, name, slug, description, image_url, sort_order, products(count)`;

/** Category columns without the `products(count)` embed (see `getCategoryBySlug`). */
const CATEGORY_BASE_COLUMNS = `id, name, slug, description, image_url, sort_order`;

type CategoryRowWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  products: { count: number }[];
};

function toCategory(row: CategoryRowWithCount): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    productCount: row.products?.[0]?.count ?? 0,
  };
}

/**
 * Active categories ordered by `sort_order`, each with its active-product count.
 * Omit `limit` to return every active category (the `/categories` index); the
 * landing passes `4`. Returns an empty array when the taxonomy has not been
 * seeded yet, so callers can fall back to a placeholder rather than crash.
 */
export async function listActiveCategories(limit?: number): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from(DATABASE_TABLES.CATEGORIES)
    .select(CATEGORY_COLUMNS)
    .eq("active", true)
    .eq(`${DATABASE_TABLES.PRODUCTS}.status`, PRODUCT_STATUS.active)
    .order("sort_order", { ascending: true });

  if (limit != null) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return (data ?? []).map((row) => toCategory(row as CategoryRowWithCount));
}

/**
 * Single active category by slug. Uses base columns (NOT the `products(count)`
 * embed): the embed's nested `status = active` filter behaves like an inner
 * join, so a category with zero active products would return no row and falsely
 * 404. The page's live active count comes from the listing's `total` instead;
 * `productCount` is defaulted to 0 to satisfy the `Category` shape.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from(DATABASE_TABLES.CATEGORIES)
    .select(CATEGORY_BASE_COLUMNS)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load category: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.image_url,
        productCount: 0,
      }
    : null;
}

/**
 * Slug + last-modified for every active category, for `sitemap.ts` only.
 * Uses the cookie-free `createSupabaseAnonClient()` — see that function's
 * doc comment for why.
 */
export async function listActiveCategorySlugsForSitemap(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.CATEGORIES)
    .select("slug, updated_at")
    .eq("active", true);

  if (error) {
    throw new Error(`Failed to load category slugs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
}

// ============================================================================
// Landing stats
// ============================================================================

/**
 * Live marketplace counts that back the landing stats. A `null` value means the
 * query failed — callers fall back to the hardcoded marketing number. These are
 * the only two headline stats that are truly derivable from the current schema;
 * buyers, sales, and average rating stay marketing placeholders until orders /
 * reviews / analytics data exist.
 */
export interface MarketplaceStats {
  /** Count of `profiles` with role `seller`. */
  sellerCount: number | null;
  /** Count of `products` with status `active`. */
  productCount: number | null;
}

/**
 * Fetches the two derivable headline counts with `head`-only count queries (no
 * rows transferred). Wrapped in React `cache()` so multiple sections rendering
 * in the same request share a single round-trip. Never throws — on any failure
 * both counts come back `null` so the UI shows its fallbacks.
 */
export const getMarketplaceStats = cache(async (): Promise<MarketplaceStats> => {
  try {
    const supabase = await createSupabaseServerClient();

    const [sellers, products] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.PROFILES)
        .select("id", { count: "exact", head: true })
        .eq("role", USER_ROLES.seller),
      supabase
        .from(DATABASE_TABLES.PRODUCTS)
        .select("id", { count: "exact", head: true })
        .eq("status", PRODUCT_STATUS.active),
    ]);

    return {
      sellerCount: sellers.error ? null : sellers.count,
      productCount: products.error ? null : products.count,
    };
  } catch {
    return { sellerCount: null, productCount: null };
  }
});

/**
 * Resolves the number to display for a stat. For a `live` stat it uses the real
 * count when one exists (> 0); otherwise — query failed, or genuinely zero rows
 * — it falls back to the stat's hardcoded value. `placeholder` stats always use
 * their hardcoded value.
 */
export function resolveStatValue(
  stat: LandingStat,
  stats: MarketplaceStats,
): number {
  if (stat.source === "live" && stat.metric) {
    const live = stats[stat.metric];
    if (live !== null && live > 0) return live;
  }
  return stat.value;
}

// ============================================================================
// Orders (buyer)
// ============================================================================

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

/**
 * Order columns plus the line items and the seller display name. Literal for
 * the same reason as `PRODUCT_COLUMNS`: Supabase's generated types parse this
 * exact string at the type level and must not be interpolated. `product` is an
 * RLS-gated live join — a sold/archived product resolves to `null`, so order
 * items keep their immutable title/price snapshots either way.
 */
const ORDER_COLUMNS = `
  id, order_number, buyer_id, seller_id, subtotal_cents, shipping_fee_cents,
  total_cents, currency, payment_status, order_status, shipping_address, notes,
  placed_at, paid_at, shipped_at, delivered_at, cancelled_at,
  buyer:profiles!orders_buyer_id_fkey ( full_name, username ),
  seller:profiles!orders_seller_id_fkey ( full_name, username, payment_qr_url ),
  order_items (
    id, product_id, product_title, quantity, unit_price_cents, subtotal_cents,
    product:products!order_items_product_id_fkey ( slug, product_images ( url ) )
  )
`;

type OrderRowWithItems = Omit<OrderRow, "shipping_address"> & {
  shipping_address: Json;
  buyer: Pick<ProfileRow, "full_name" | "username"> | null;
  seller: Pick<ProfileRow, "full_name" | "username" | "payment_qr_url"> | null;
  order_items: Array<
    OrderItemRow & {
      product: { slug: string; product_images: { url: string }[] } | null;
    }
  >;
};

/** Maps the `shipping_address` jsonb snapshot onto the domain model. */
function toShippingAddress(value: Json): ShippingAddress | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.full_name !== "string") return null;
  const str = (key: string): string | null =>
    typeof record[key] === "string" ? (record[key] as string) : null;
  return {
    fullName: record.full_name,
    line1: str("line1") ?? "",
    line2: str("line2"),
    city: str("city") ?? "",
    postalCode: str("postal_code") ?? "",
    country: str("country") ?? "",
    phone: str("phone"),
  };
}

/** Maps a database row onto the order domain model the app consumes. */
function toOrder(row: OrderRowWithItems): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.order_status,
    paymentStatus: row.payment_status,
    subtotalCents: row.subtotal_cents,
    shippingFeeCents: row.shipping_fee_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    shippingAddress: toShippingAddress(row.shipping_address),
    notes: row.notes,
    buyerId: row.buyer_id,
    buyerName: row.buyer?.full_name ?? row.buyer?.username ?? null,
    sellerId: row.seller_id,
    sellerName: row.seller?.full_name ?? row.seller?.username ?? null,
    sellerPaymentQrUrl: row.seller?.payment_qr_url ?? null,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productTitle: item.product_title,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      subtotalCents: item.subtotal_cents,
      productSlug: item.product?.slug ?? null,
      imageUrl: item.product?.product_images?.[0]?.url ?? null,
    })),
    placedAt: row.placed_at,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    cancellable: CANCELLABLE_ORDER_STATUSES.includes(row.order_status),
  };
}

/**
 * The signed-in buyer's order history: newest first, with an optional Order-ID
 * search (the proposal storyboard's "manually enter an Order ID") and an
 * optional status filter. RLS restricts rows to `buyer_id = auth.uid()`.
 */
export async function listBuyerOrders(
  buyerId: string,
  params: OrderListParams,
): Promise<PaginatedResult<Order>> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from(DATABASE_TABLES.ORDERS)
    .select(ORDER_COLUMNS, { count: "exact" })
    .eq("buyer_id", buyerId);

  if (params.search) {
    query = query.ilike("order_number", `%${params.search}%`);
  }
  if (params.status) {
    query = query.eq("order_status", params.status);
  }

  query = query.order("placed_at", { ascending: false });

  const { from, to } = toRange(params);
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => toOrder(row as OrderRowWithItems)),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/**
 * Single order by id for the signed-in buyer. Returns null when the order does
 * not belong to this buyer (RLS + the `buyer_id` filter). `cache()`d so the
 * page and its metadata share one fetch per request.
 */
export const getBuyerOrder = cache(
  async (orderId: string, buyerId: string): Promise<Order | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ORDERS)
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .eq("buyer_id", buyerId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load order: ${error.message}`);
    }

    return data ? toOrder(data as OrderRowWithItems) : null;
  },
);

/**
 * Overview-hub payload: an exact per-status count (7 head-only queries, no row
 * transfer) plus the 5 most recent orders.
 */
export async function getBuyerOrderSummary(
  buyerId: string,
): Promise<OrderSummary> {
  const supabase = await createSupabaseServerClient();

  const counts = await Promise.all(
    ORDER_STATUS_FLOW.map(async (status) => {
      const { count, error } = await supabase
        .from(DATABASE_TABLES.ORDERS)
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId)
        .eq("order_status", status);
      return [status, error ? 0 : (count ?? 0)] as const;
    }),
  );

  const statusCounts = Object.fromEntries(counts) as Record<OrderStatus, number>;

  const recent = await listBuyerOrders(buyerId, { page: 1, pageSize: 5 });

  return { statusCounts, recentOrders: recent.items };
}

/**
 * Dashboard equivalent of `getBuyerOrderSummary` — same per-status-count +
 * 5-most-recent shape, but with no manual owner filter: matches
 * `listDashboardOrders`'s existing "RLS is the primary boundary" convention
 * (a seller's rows are scoped to `seller_id = auth.uid()`, an admin sees
 * every order).
 */
export async function getDashboardOrderSummary(): Promise<OrderSummary> {
  const supabase = await createSupabaseServerClient();

  const counts = await Promise.all(
    ORDER_STATUS_FLOW.map(async (status) => {
      const { count, error } = await supabase
        .from(DATABASE_TABLES.ORDERS)
        .select("id", { count: "exact", head: true })
        .eq("order_status", status);
      return [status, error ? 0 : (count ?? 0)] as const;
    }),
  );

  const statusCounts = Object.fromEntries(counts) as Record<OrderStatus, number>;

  const recent = await listDashboardOrders({ page: 1, pageSize: 5 });

  return { statusCounts, recentOrders: recent.items };
}

/**
 * Cancels one of the buyer's own orders. Ownership is enforced by RLS and the
 * `buyer_id` filter; the cancellable-state rule (pending/confirmed) is enforced
 * here because the DB trigger permits a buyer to set `cancelled` from any state.
 */
export async function cancelBuyerOrder(
  orderId: string,
  buyerId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from(DATABASE_TABLES.ORDERS)
    .select("order_status")
    .eq("id", orderId)
    .eq("buyer_id", buyerId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to load order: ${readError.message}`);
  }
  if (!existing) {
    throw new Error("Order not found.");
  }
  if (!CANCELLABLE_ORDER_STATUSES.includes(existing.order_status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  const { error } = await supabase
    .from(DATABASE_TABLES.ORDERS)
    .update({
      order_status: ORDER_STATUS.cancelled,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("buyer_id", buyerId);

  if (error) {
    throw new Error(`Failed to cancel order: ${error.message}`);
  }
}

/**
 * Every order visible to the caller for management purposes — no manual
 * seller/admin filtering, matching `listDashboardInventory()`'s "RLS is the
 * primary boundary" pattern: a seller sees their own orders
 * (`seller_id = auth.uid()`), an admin sees every order. Safe to rely on RLS
 * alone here because `orders`' SELECT policy has no public/unscoped clause
 * (unlike `products` — see `listDashboardProducts()`'s owner-filter note).
 */
export async function listDashboardOrders(
  params: OrderListParams,
): Promise<PaginatedResult<Order>> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from(DATABASE_TABLES.ORDERS)
    .select(ORDER_COLUMNS, { count: "exact" });

  if (params.search) {
    query = query.ilike("order_number", `%${params.search}%`);
  }
  if (params.status) {
    query = query.eq("order_status", params.status);
  }

  query = query.order("placed_at", { ascending: false });

  const { from, to } = toRange(params);
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => toOrder(row as OrderRowWithItems)),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/**
 * Single order by id for the dashboard (seller/admin) — no ownership filter;
 * RLS alone determines visibility. Kept distinct from `getBuyerOrder`, which
 * deliberately narrows to "orders where I'm the buyer" even though RLS would
 * already scope it — collapsing them would blur that intent.
 */
export const getDashboardOrder = cache(
  async (orderId: string): Promise<Order | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ORDERS)
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load order: ${error.message}`);
    }

    return data ? toOrder(data as OrderRowWithItems) : null;
  },
);

/**
 * Advances (or cancels) an order's fulfilment status from the dashboard.
 * Validates the transition against `ORDER_STATUS_TRANSITIONS` — the DB
 * trigger permits the seller/admin to set `order_status` to anything, so this
 * app-level check is the actual forward-flow guard (same shape as
 * `cancelBuyerOrder`'s `CANCELLABLE_ORDER_STATUSES` check). The second
 * `.eq("order_status", currentStatus)` on the write is a cheap optimistic-
 * concurrency guard: 0 rows affected means the status already changed
 * (e.g. a double-click), surfaced as a friendly retry error rather than a
 * silent no-op. Cancelling an order (newStatus = 'cancelled') restocks
 * automatically via the `orders_restock_on_cancel` trigger — no extra code
 * needed here.
 */
/**
 * `sellerId`: the caller's own id for a non-admin request (`null` = admin,
 * no extra filter). Orders aren't shop-scoped, so unlike the product
 * functions above this is a plain equality filter, not an OR. Defense-in-
 * depth alongside RLS — see the 2026-08-20 audit.
 */
export async function advanceOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  sellerId: string | null,
): Promise<Order> {
  const supabase = await createSupabaseServerClient();

  let readQuery = supabase
    .from(DATABASE_TABLES.ORDERS)
    .select("order_status")
    .eq("id", orderId);
  if (sellerId) readQuery = readQuery.eq("seller_id", sellerId);

  const { data: existing, error: readError } = await readQuery.maybeSingle();

  if (readError) {
    throw new Error(`Failed to load order: ${readError.message}`);
  }
  if (!existing) {
    throw new Error("Order not found.");
  }

  const currentStatus = existing.order_status;
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot move an order from "${getOrderStatusLabel(currentStatus)}" to "${getOrderStatusLabel(newStatus)}".`,
    );
  }

  let writeQuery = supabase
    .from(DATABASE_TABLES.ORDERS)
    .update({ order_status: newStatus })
    .eq("id", orderId)
    .eq("order_status", currentStatus);
  if (sellerId) writeQuery = writeQuery.eq("seller_id", sellerId);

  const { data, error } = await writeQuery.select(ORDER_COLUMNS).maybeSingle();

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      "This order's status has already changed. Refresh and try again.",
    );
  }

  return toOrder(data as OrderRowWithItems);
}

/** One seller-order to create. `shippingAddress` uses the DB's snake_case keys. */
export interface CreateOrderInput {
  sellerId: string;
  items: { productId: string; quantity: number }[];
  shippingAddress: Json;
  shippingFeeCents: number;
  notes?: string | null;
}

/**
 * Creates one seller's order via the `create_order` RPC — the only sanctioned
 * order path (`database.md` §3.7). It is atomic (`FOR UPDATE`), re-prices from
 * live `products.price_cents`, decrements stock, and sets `sold` at 0; `buyer_id`
 * always comes from `auth.uid()`. Returns a light handle for the checkout result;
 * RPC errors (e.g. "Only 2 left of X") surface as thrown messages.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ orderId: string; orderNumber: string; sellerId: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_order", {
    p_seller_id: input.sellerId,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    p_shipping_address: input.shippingAddress,
    p_shipping_fee_cents: input.shippingFeeCents,
    p_notes: input.notes ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Could not create the order.");
  }

  return {
    orderId: data.id,
    orderNumber: data.order_number,
    sellerId: data.seller_id,
  };
}

// ============================================================================
// Profile (buyer account)
// ============================================================================

/** Maps a profiles row onto the account domain model. */
function toProfile(
  row: Pick<
    ProfileRow,
    | "id"
    | "full_name"
    | "username"
    | "avatar_url"
    | "phone"
    | "bio"
    | "payment_qr_url"
    | "role"
  >,
): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    bio: row.bio,
    paymentQrUrl: row.payment_qr_url,
    role: row.role,
  };
}

/**
 * The signed-in user's own profile row, including `phone`. Read via the
 * `get_my_profile()` SECURITY DEFINER RPC — the only path to `phone`, because
 * the column is not granted for direct SELECT (audit H1 remediation).
 */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_profile");

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data ? toProfile(data) : null;
}

/**
 * Updates the signed-in user's own profile. RLS limits the write to their row,
 * the column grant covers these columns, and the `prevent_role_self_escalation`
 * trigger blocks any role tampering.
 */
export async function updateMyProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .update({
      full_name: input.fullName || null,
      username: input.username || null,
      avatar_url: input.avatarUrl || null,
      phone: input.phone || null,
      bio: input.bio || null,
      payment_qr_url: input.paymentQrUrl || null,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(
      mapPostgresError(error, "Failed to update profile. Please try again."),
    );
  }

  // Re-read the authoritative row via the get_my_profile() RPC — the only path
  // that may return `phone`, which is withheld from direct SELECT for
  // authenticated (audit H1). Requesting it from this UPDATE's RETURNING clause
  // would be denied by the same column grant, so the update must not select it.
  const profile = await getMyProfile();
  if (!profile) {
    throw new Error("Failed to load your profile after saving.");
  }
  return profile;
}

// ============================================================================
// Payments (QR receipt upload + manual verification — ADR-008)
// ============================================================================

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/**
 * Payment columns plus the parent order's number and buyer name, for the
 * seller/admin verification queue. Literal for the same reason as
 * `PRODUCT_COLUMNS`/`ORDER_COLUMNS` — parsed at the type level, must not be
 * interpolated.
 */
const PAYMENT_COLUMNS = `
  id, order_id, receipt_path, failure_reason, payment_method_type, amount_cents,
  currency, status, verified_by, verified_at, created_at,
  order:orders!payments_order_id_fkey (
    order_number,
    buyer:profiles!orders_buyer_id_fkey ( full_name, username )
  )
`;

type PaymentRowWithOrder = PaymentRow & {
  order: {
    order_number: string;
    buyer: Pick<ProfileRow, "full_name" | "username"> | null;
  } | null;
};

function toPayment(row: PaymentRowWithOrder): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order?.order_number ?? "",
    buyerName: row.order?.buyer?.full_name ?? row.order?.buyer?.username ?? null,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    receiptPath: row.receipt_path,
    failureReason: row.failure_reason,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

/**
 * Uploads a QR payment receipt image to the private `payment-receipts`
 * bucket. Path is `{orderId}/{uuid}.{ext}` — RLS on `storage.objects` (see
 * the storage migration) authorizes via the order, not the path alone.
 * Returns the storage path (not a URL — the bucket is private).
 */
export async function uploadPaymentReceipt(
  orderId: string,
  file: File,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("payment-receipts")
    .upload(path, file, { contentType: file.type });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }
  return path;
}

/**
 * Records a buyer's QR payment submission via the `submit_qr_payment` RPC —
 * the sole write path into `payments` for buyers (no direct INSERT grant
 * exists). Re-prices from the order's own total; ownership and
 * already-pending checks happen inside the RPC.
 */
export async function submitQrPayment(
  orderId: string,
  receiptPath: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_qr_payment", {
    p_order_id: orderId,
    p_receipt_path: receiptPath,
  });

  if (error) {
    throw new Error(
      mapPostgresError(error, "Could not submit your payment receipt."),
    );
  }
}

/**
 * Seller (of the order) or admin marks a pending payment paid/failed via the
 * `verify_payment` RPC — the sole write path for verification (no direct
 * UPDATE grant exists). Also flips the parent order's `payment_status` in the
 * same RPC transaction.
 */
export async function verifyPayment(
  paymentId: string,
  decision: PaymentDecision,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("verify_payment", {
    p_payment_id: paymentId,
    p_decision: decision,
  });

  if (error) {
    throw new Error(mapPostgresError(error, "Could not verify this payment."));
  }
}

/**
 * Short-lived signed URL for a receipt image — the bucket is private, so
 * there is no public URL to store or render directly.
 */
export async function getPaymentReceiptSignedUrl(path: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path, 60 * 10);

  if (error || !data) {
    throw new Error(`Failed to load receipt: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

/**
 * Pending payments for the verification queue. No manual `seller_id`
 * filtering here — RLS alone restricts visible rows to the caller's own
 * orders-as-seller, or all rows for an admin (same "RLS is the primary
 * boundary" pattern as everywhere else in this file).
 */
export async function listPendingPayments(): Promise<Payment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PAYMENTS)
    .select(PAYMENT_COLUMNS)
    .eq("status", PAYMENT_STATUS.pending)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load pending payments: ${error.message}`);
  }

  return (data ?? []).map((row) => toPayment(row as PaymentRowWithOrder));
}

// ============================================================================
// Shops
// ============================================================================

type ShopRow = Database["public"]["Tables"]["shops"]["Row"];

function toShop(row: ShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Shops visible to the caller. No manual membership filtering here — RLS
 * alone restricts visible rows to the caller's own shop(s) via
 * `is_shop_member()`, or every shop for an admin (same "RLS is the primary
 * boundary" pattern as `listPendingPayments`).
 */
export async function listShops(): Promise<Shop[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.SHOPS)
    .select("id, name, slug, active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load shops: ${error.message}`);
  }

  return (data ?? []).map((row) => toShop(row as ShopRow));
}

type ShopMembershipRow = {
  seller_id: string;
  shop_id: string;
  shop_name: string;
};

/**
 * Resolves real shop identity for buyer-facing product surfaces via the
 * `resolve_shop_membership` RPC — `products.shop_id` is unpopulated on every
 * live row (TD-1), and `shop_users` (the table that actually holds this
 * mapping) is member/admin-only RLS, so a buyer/guest cannot read it
 * directly (see the RPC's migration comment). Returns a `sellerId ->
 * shopName` map; empty input short-circuits without a round trip.
 */
export async function getShopNamesBySellerIds(
  sellerIds: string[],
): Promise<Map<string, string>> {
  if (sellerIds.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_shop_membership", {
    p_seller_ids: sellerIds,
  });

  if (error) {
    throw new Error(`Failed to resolve shop names: ${error.message}`);
  }
  return new Map(
    ((data ?? []) as ShopMembershipRow[]).map((row) => [
      row.seller_id,
      row.shop_name,
    ]),
  );
}

/** Every seller id belonging to one shop — used to filter the catalog by shop. */
export async function getShopSellerIds(shopId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_shop_membership", {
    p_shop_ids: [shopId],
  });

  if (error) {
    throw new Error(`Failed to resolve shop members: ${error.message}`);
  }
  return ((data ?? []) as ShopMembershipRow[]).map((row) => row.seller_id);
}

export interface FeaturedShopView {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

/**
 * Active shops with a real active-product count, for the homepage's Featured
 * Shops carousel. Composed from two already-public reads (`listShops`,
 * `resolve_shop_membership`) plus one lightweight `products` read — no new
 * RPC beyond `resolve_shop_membership`, and no fabricated rating/badge/image
 * fields (there is no data source for any of those).
 */
export async function getFeaturedShops(limit = 4): Promise<FeaturedShopView[]> {
  const shops = await listShops();
  if (shops.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const [membershipResult, productsResult] = await Promise.all([
    supabase.rpc("resolve_shop_membership", {
      p_shop_ids: shops.map((shop) => shop.id),
    }),
    supabase
      .from(DATABASE_TABLES.PRODUCTS)
      .select("seller_id")
      .eq("status", PRODUCT_STATUS.active),
  ]);

  if (membershipResult.error) {
    throw new Error(
      `Failed to resolve shop members: ${membershipResult.error.message}`,
    );
  }
  if (productsResult.error) {
    throw new Error(
      `Failed to count shop products: ${productsResult.error.message}`,
    );
  }

  const countsBySeller = new Map<string, number>();
  for (const row of productsResult.data ?? []) {
    countsBySeller.set(
      row.seller_id,
      (countsBySeller.get(row.seller_id) ?? 0) + 1,
    );
  }

  const countsByShop = new Map<string, number>();
  for (const row of (membershipResult.data ?? []) as ShopMembershipRow[]) {
    const current = countsByShop.get(row.shop_id) ?? 0;
    countsByShop.set(
      row.shop_id,
      current + (countsBySeller.get(row.seller_id) ?? 0),
    );
  }

  return shops
    .map((shop) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      productCount: countsByShop.get(shop.id) ?? 0,
    }))
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, limit);
}

/** Payload for creating a shop — `slug` is always server-derived from `name`, never client-submitted. */
export interface CreateShopInput {
  name: string;
}

/** Admin-only: creates a shop. RLS (`is_admin()`) is the authorization boundary — no RPC needed, unlike cross-user writes. */
export async function createShop(input: CreateShopInput): Promise<Shop> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.SHOPS)
    .insert({
      name: input.name,
      slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
    })
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(mapPostgresError(error, "Failed to create shop."));
  }

  return toShop(data as ShopRow);
}

/** Payload for editing a shop's name and/or active status. */
export interface UpdateShopInput {
  id: string;
  name?: string;
  active?: boolean;
}

/** Admin-only: edits a shop. RLS (`is_admin()`) is the authorization boundary. */
export async function updateShop(input: UpdateShopInput): Promise<Shop> {
  const supabase = await createSupabaseServerClient();
  const { id, ...rest } = input;

  const { data, error } = await supabase
    .from(DATABASE_TABLES.SHOPS)
    .update(rest)
    .eq("id", id)
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to update shop: ${error.message}`);
  }

  return toShop(data as ShopRow);
}

type ShopRowWithMembers = ShopRow & {
  shop_users: Array<{
    user_id: string;
    member: Pick<ProfileRow, "full_name" | "username"> | null;
  }>;
};

function toShopWithMember(row: ShopRowWithMembers): ShopWithMember {
  const membership = row.shop_users?.[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberId: membership?.user_id ?? null,
    memberName: membership?.member?.full_name ?? membership?.member?.username ?? null,
  };
}

/**
 * Every shop plus its current member, for the admin Shops management screen —
 * distinct from `listShops()` (kept unchanged, id/name/slug/active only, used
 * by the Products/Inventory admin shop-picker) so that screen's shape never
 * has to change to support this one's richer needs.
 */
export async function listShopsWithMembers(): Promise<ShopWithMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.SHOPS)
    .select(`
      id, name, slug, active, created_at, updated_at,
      shop_users ( user_id, member:profiles!shop_users_user_id_fkey ( full_name, username ) )
    `)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load shops: ${error.message}`);
  }

  return (data ?? []).map((row) => toShopWithMember(row as ShopRowWithMembers));
}

// ============================================================================
// Admin: Users
// ============================================================================

/**
 * Every user, admin-only, via the `admin_list_users` RPC — the sole path to
 * see email (never otherwise joinable from `public.profiles`; mirrors
 * `get_my_profile()`'s shape but admin- rather than self-scoped). Authorization
 * is re-checked inside the RPC itself, not just relied on via the caller's
 * `requireRole` gate.
 */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_users");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    shopId: row.shop_id,
    shopName: row.shop_name,
  }));
}

/**
 * Promotes a buyer to seller and/or (re)assigns their shop via the
 * `admin_assign_seller_shop` RPC — the sole write path (no direct UPDATE
 * grant exists for writing another user's `profiles.role`, and RLS never
 * exposes another user's row to an admin for a plain client update). Atomic:
 * role change + shop membership + audit log row, one transaction.
 */
export async function assignSellerShop(
  userId: string,
  shopId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_assign_seller_shop", {
    p_user_id: userId,
    p_shop_id: shopId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Every product visible to the caller for management purposes — no status
 * filter (unlike `listProducts`, built for the storefront).
 *
 * Unlike `listDashboardOrders`/`listDashboardInventory`, this **cannot**
 * rely on RLS alone: `products`' SELECT policy has a standalone
 * `status = 'active' or seller_id = auth.uid() or is_admin()` clause (it
 * also has to serve the public storefront), so "no manual filter" here would
 * return every *active* product from every seller platform-wide, not just
 * the caller's own — a seller's dashboard list would silently include other
 * sellers' listings (discovered 2026-08-21: this let a seller "Edit" a
 * product that wasn't theirs, then fail confusingly on save/image-upload).
 * `owner`: `null` = admin (no filter, sees everything); otherwise scoped to
 * the caller's own products or shop, matching `updateProduct`/`archiveProduct`'s
 * owner-filter shape.
 */
export async function listDashboardProducts(
  owner: { sellerId: string; shopId: string | null } | null,
): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from(DATABASE_TABLES.PRODUCTS).select(PRODUCT_COLUMNS);

  if (owner) {
    query = query.or(
      owner.shopId
        ? `seller_id.eq.${owner.sellerId},shop_id.eq.${owner.shopId}`
        : `seller_id.eq.${owner.sellerId}`,
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return (data ?? []).map((row) => toProduct(row as ProductRowWithImages));
}

/**
 * Admin-only: assigns a shop to a legacy/unassigned product (`shop_id`
 * currently `null`). Relies on `is_admin()` in RLS — the caller's admin
 * status is the actual authorization boundary, not this function.
 */
export async function assignProductShop(
  productId: string,
  shopId: string,
): Promise<Product> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .update({ shop_id: shopId })
    .eq("id", productId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to assign shop: ${error.message}`);
  }

  return toProduct(data as ProductRowWithImages);
}

/**
 * The active (pending) payment for one of the buyer's own orders, or null if
 * none has been submitted yet. Used by the order detail page to decide
 * whether to show the receipt-upload prompt or a "submitted" status.
 */
export async function getActivePaymentForOrder(
  orderId: string,
): Promise<Payment | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PAYMENTS)
    .select(PAYMENT_COLUMNS)
    .eq("order_id", orderId)
    .in("status", [PAYMENT_STATUS.pending, PAYMENT_STATUS.paid])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment: ${error.message}`);
  }
  return data ? toPayment(data as PaymentRowWithOrder) : null;
}

// ============================================================================
// Inventory
// ============================================================================

type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type StockAdjustmentRow = Database["public"]["Tables"]["stock_adjustments"]["Row"];

/**
 * Inventory columns plus the parent product's title/slug/status and the
 * owning shop's name — everything the dashboard list needs in one round
 * trip. Literal for the same reason as `PRODUCT_COLUMNS`/`PAYMENT_COLUMNS`.
 */
const INVENTORY_COLUMNS = `
  id, product_id, shop_id, quantity, low_stock_threshold, created_at, updated_at,
  product:products!inventory_product_id_fkey ( title, slug, status ),
  shop:shops!inventory_shop_id_fkey ( name )
`;

type InventoryRowWithJoins = InventoryRow & {
  product: Pick<ProductRow, "title" | "slug" | "status"> | null;
  shop: { name: string } | null;
};

function toInventoryItem(row: InventoryRowWithJoins): InventoryItem {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.product?.title ?? "",
    productSlug: row.product?.slug ?? "",
    productStatus: (row.product?.status ?? PRODUCT_STATUS.draft) as ProductStatus,
    shopId: row.shop_id,
    shopName: row.shop?.name ?? null,
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    stockStatus: getStockStatus(row.quantity, row.low_stock_threshold),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Every inventory row visible to the caller — no manual shop/seller
 * filtering. Safe to rely on RLS alone here (unlike `listDashboardProducts()`,
 * which needs an explicit owner filter): `inventory`'s SELECT policy has no
 * public/unscoped clause, so a shop member sees only their own shop's stock,
 * an admin sees every shop's.
 */
export async function listDashboardInventory(): Promise<InventoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.INVENTORY)
    .select(INVENTORY_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load inventory: ${error.message}`);
  }

  return (data ?? []).map((row) => toInventoryItem(row as InventoryRowWithJoins));
}

/** Single inventory row for one product, or null if none exists yet. */
export async function getInventoryForProduct(
  productId: string,
): Promise<InventoryItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.INVENTORY)
    .select(INVENTORY_COLUMNS)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load inventory: ${error.message}`);
  }
  return data ? toInventoryItem(data as InventoryRowWithJoins) : null;
}

/**
 * Manually adjusts one product's stock via the `adjust_stock` RPC — the sole
 * write path for restock/correction/shrinkage/other changes (no direct
 * UPDATE grant exists on `inventory`). Authorization (shop membership or
 * admin) is re-checked inside the RPC itself, not just by RLS. The RPC's
 * raised messages (e.g. "Cannot reduce stock below zero") are already
 * friendly, so the error is surfaced as-is, mirroring `createOrder()`.
 */
export async function adjustStock(input: AdjustStockInput): Promise<InventoryItem> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: input.productId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const item = await getInventoryForProduct(input.productId);
  if (!item) {
    throw new Error("Could not load the updated inventory record.");
  }
  return item;
}

/**
 * Stock adjustment columns plus the acting profile's display name — the
 * `note` explains *why* an adjustment happened, this explains *who* made it
 * (null for system-driven rows: sale, cancellation restock).
 */
const STOCK_ADJUSTMENT_COLUMNS = `
  id, product_id, shop_id, delta, previous_quantity, new_quantity, reason,
  note, related_order_id, created_by, created_at,
  actor:profiles!stock_adjustments_created_by_fkey ( full_name, username )
`;

type StockAdjustmentRowWithActor = StockAdjustmentRow & {
  actor: Pick<ProfileRow, "full_name" | "username"> | null;
};

function toStockAdjustment(row: StockAdjustmentRowWithActor): StockAdjustment {
  return {
    id: row.id,
    productId: row.product_id,
    shopId: row.shop_id,
    delta: row.delta,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    reason: row.reason,
    note: row.note,
    relatedOrderId: row.related_order_id,
    createdBy: row.created_by,
    createdByName: row.actor?.full_name ?? row.actor?.username ?? null,
    createdAt: row.created_at,
  };
}

/** Recent stock movement history for one product, newest first. RLS scopes it identically to `inventory`. */
export async function listStockAdjustments(
  productId: string,
  limit = 20,
): Promise<StockAdjustment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.STOCK_ADJUSTMENTS)
    .select(STOCK_ADJUSTMENT_COLUMNS)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load stock history: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    toStockAdjustment(row as StockAdjustmentRowWithActor),
  );
}

// ============================================================================
// Reports & analytics
// ============================================================================
//
// All four reads call the matching `report_*` SECURITY DEFINER RPC, which
// re-enforces scoping internally (seller → own orders; admin → all, or one shop
// via `shopId`). No manual seller/shop filtering here, and no `.from()` on
// orders — the RPC does the aggregation DB-side. Amounts stay integer cents.
// `shopId` is only meaningful for admins; the RPC ignores it for sellers.

const EMPTY_SALES_SUMMARY: SalesSummary = {
  totalOrders: 0,
  paidOrders: 0,
  cancelledOrders: 0,
  revenueCents: 0,
  unitsSold: 0,
  avgOrderValueCents: 0,
  codPaidOrders: 0,
  qrPaidOrders: 0,
  pendingPaymentOrders: 0,
};

/** KPI summary for a Manila date range. Always resolves (zeros when no orders). */
export const getSalesSummary = cache(async function getSalesSummary(
  from: string,
  to: string,
  shopId: string | null = null,
): Promise<SalesSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_sales_summary", {
    p_from: from,
    p_to: to,
    p_shop_id: shopId ?? undefined,
  });

  if (error) {
    throw new Error(`Failed to load sales summary: ${error.message}`);
  }

  const row = data?.[0];
  if (!row) return EMPTY_SALES_SUMMARY;
  return {
    totalOrders: row.total_orders,
    paidOrders: row.paid_orders,
    cancelledOrders: row.cancelled_orders,
    revenueCents: row.revenue_cents,
    unitsSold: row.units_sold,
    avgOrderValueCents: row.avg_order_value_cents,
    codPaidOrders: row.cod_paid_orders,
    qrPaidOrders: row.qr_paid_orders,
    pendingPaymentOrders: row.pending_payment_orders,
  };
});

/** Order count + paid revenue per time bucket (only non-empty buckets). */
export const getSalesTimeseries = cache(async function getSalesTimeseries(
  from: string,
  to: string,
  granularity: ReportGranularity,
  shopId: string | null = null,
): Promise<SalesTrendPoint[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_sales_timeseries", {
    p_from: from,
    p_to: to,
    p_granularity: granularity,
    p_shop_id: shopId ?? undefined,
  });

  if (error) {
    throw new Error(`Failed to load sales trend: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    bucket: row.bucket,
    orderCount: row.order_count,
    revenueCents: row.revenue_cents,
  }));
});

/** Order counts grouped by fulfilment status within the range. */
export const getOrderStatusBreakdown = cache(
  async function getOrderStatusBreakdown(
    from: string,
    to: string,
    shopId: string | null = null,
  ): Promise<OrderStatusCount[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "report_order_status_breakdown",
      { p_from: from, p_to: to, p_shop_id: shopId ?? undefined },
    );

    if (error) {
      throw new Error(`Failed to load status breakdown: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      status: row.status,
      orderCount: row.order_count,
    }));
  },
);

/** Best-selling products by units (revenue over the paid subset). */
export const getTopProducts = cache(async function getTopProducts(
  from: string,
  to: string,
  limit: number,
  shopId: string | null = null,
): Promise<TopProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_top_products", {
    p_from: from,
    p_to: to,
    p_limit: limit,
    p_shop_id: shopId ?? undefined,
  });

  if (error) {
    throw new Error(`Failed to load top products: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    productId: row.product_id,
    productTitle: row.product_title,
    unitsSold: row.units_sold,
    revenueCents: row.revenue_cents,
  }));
});

/**
 * Low- and out-of-stock rows for the report, reusing the existing RLS-scoped
 * inventory read (no new SQL). A seller sees their own shop's stock; an admin
 * sees every shop's.
 */
export async function getLowStockReport(): Promise<InventoryItem[]> {
  const items = await listDashboardInventory();
  return items
    .filter((item) => item.stockStatus !== "in_stock")
    .sort((a, b) => a.quantity - b.quantity);
}

// ============================================================================
// Auth / session
// ============================================================================

/** Absolute URL of the PKCE callback, optionally forwarding a post-auth path. */
function callbackUrl(next?: string) {
  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.authCallback}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/**
 * Current user with the profile row merged in, or null when signed out.
 * `cache()`-wrapped so the layout, page, and metadata share one auth + profile
 * round-trip per request (audit H3 remediation).
 */
export const getSessionUser = cache(
  async (): Promise<SessionUser | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email ?? "",
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: profile?.role ?? USER_ROLES.buyer,
    };
  },
);

/**
 * True only when the current session's JWT records a "recovery" auth method
 * — i.e. it was established by clicking a password-recovery email link, not
 * an ordinary sign-in. `getClaims()` verifies the JWT itself (unlike
 * `getSession()`), so this is safe to use as an authorization gate.
 * Used by the reset-password screen so a hijacked ordinary session can't
 * reach the password-change form without going through recovery.
 */
export async function hasRecoverySession(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return false;

  const amr = data.claims.amr ?? [];
  return amr.some((entry) =>
    typeof entry === "string" ? entry === "recovery" : entry.method === "recovery",
  );
}

/**
 * Throws unless the current session came from a password-recovery link.
 * Use at the top of `updatePasswordAction` — the page-level check in
 * `reset-password/page.tsx` is the primary UX gate, this is the
 * belt-and-suspenders re-check at the Server Action boundary.
 */
export async function requireRecoverySession(): Promise<void> {
  if (!(await hasRecoverySession())) {
    throw new Error("This password reset link has expired. Please request a new one.");
  }
}

/** Throws when unauthenticated — use at the top of protected Server Actions. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }
  return user;
}

/** Throws when the user lacks one of the allowed roles. */
export async function requireRole(
  allowed: readonly UserRole[],
): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!allowed.includes(user.role as UserRole)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

/**
 * Resolves the caller's own shop via `shop_users` — never trusts a
 * client-submitted shop id. Throws a friendly error for a seller with no
 * shop membership yet (an admin has no shop of their own; callers needing an
 * admin-selectable shop should use `listShops()` instead).
 */
/** Nullable variant of `requireOwnShopId` — a seller may legitimately have no shop. */
export async function getOwnShopId(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.SHOP_USERS)
    .select("shop_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve your shop: ${error.message}`);
  }
  return data?.shop_id ?? null;
}

export async function requireOwnShopId(): Promise<string> {
  const user = await requireSessionUser();
  const shopId = await getOwnShopId(user.id);
  if (!shopId) {
    throw new Error("Your account isn't linked to a shop yet. Contact an administrator.");
  }
  return shopId;
}

/**
 * Throws when `key` has been hit more than `maxHits` times within
 * `windowSeconds` — use at the top of a Server Action, after
 * `requireSessionUser()`/`requireRole()`, right before the mutation. Backed
 * by the `check_rate_limit` Postgres function (fixed-window counter; see its
 * migration for the concurrency/tradeoff notes).
 */
export async function requireRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail open on infrastructure errors — a broken rate limiter should never
    // itself take down profile updates/order cancellation/cart checks.
    return;
  }
  if (data === false) {
    throw new Error("Too many attempts. Please try again in a moment.");
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) throw new Error(error.message);
}

/**
 * Starts the PKCE OAuth flow for `provider` and returns the provider's
 * consent-screen URL. Does not redirect itself — there is no `window` in a
 * Server Action, so `signInWithOAuth` never auto-navigates here regardless;
 * the caller must `redirect(url)` explicitly.
 *
 * Whether this reuses an existing account or creates a new one is decided
 * server-side by Supabase Auth (GoTrue) before this call returns — it links
 * to an existing user only when the incoming identity's email is verified by
 * the provider, and never on a bare email-string match. Do not add
 * email-based matching logic anywhere in this app; that would bypass
 * Supabase's own pre-account-takeover safeguard.
 */
export async function signInWithOAuth(provider: OAuthProvider, next?: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(next) },
  });
  if (error) throw new Error(error.message);
  if (!data.url) throw new Error("The sign-in provider did not return a redirect URL.");
  return data.url;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
  captchaToken: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Confirmation link lands on the PKCE callback, which sets the session.
      emailRedirectTo: callbackUrl(),
      captchaToken,
    },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

/**
 * Sends a password-recovery email. The link returns to the PKCE callback, which
 * establishes a session and forwards to the reset-password screen (built in the
 * auth phase).
 */
export async function sendPasswordResetEmail(email: string, captchaToken: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(ROUTES.resetPassword),
    captchaToken,
  });
  if (error) throw new Error(error.message);
}

/**
 * Sets a new password for the currently-authenticated (recovery) session,
 * then revokes every *other* session on the account. A successful password
 * recovery is a strong proof of ownership — this is the right moment to
 * shake loose any other session (a stale device, or one an attacker
 * obtained through a different vector) rather than leaving it valid.
 */
export async function updatePassword(newPassword: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  // Read back the (now-updated) session's access token purely to identify
  // it to the admin API below — not used for any auth decision, so this is
  // a safe, narrow exception to the "use getUser(), not getSession()" rule.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    try {
      // Best-effort: a failure here (including a missing service-role key
      // in local dev) must not fail the password change itself.
      const admin = createSupabaseAdminClient();
      await admin.auth.admin.signOut(session.access_token, "others");
    } catch {
      // Swallowed deliberately — see comment above.
    }
  }
}

/** Re-sends the sign-up confirmation email for an unverified address. */
export async function resendVerificationEmail(email: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw new Error(error.message);
}

/**
 * All identities (password, Google, Facebook, …) linked to the current
 * session's user. Requires an authenticated session — call behind
 * `requireSessionUser()`.
 */
export async function listUserIdentities(): Promise<UserIdentity[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw new Error(error.message);
  return data.identities;
}

/**
 * Manual identity linking (Supabase Dashboard → Authentication →
 * "Enable Manual Linking" must be on): attaches `provider` to the
 * *currently signed-in* user, regardless of whether its email matches or is
 * verified — safe specifically because the caller is already proven to own
 * the target account, unlike automatic linking, which only trusts a
 * provider-verified email. This is the sanctioned fallback for cases (e.g.
 * Facebook without a verified email) where `signInWithOAuth` cannot safely
 * auto-link on its own. Same PKCE round trip as `signInWithOAuth`; the
 * existing `/auth/callback` route completes it unchanged.
 */
export async function linkOAuthIdentity(provider: OAuthProvider, next?: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: callbackUrl(next) },
  });
  if (error) throw new Error(error.message);
  if (!data.url) throw new Error("The sign-in provider did not return a redirect URL.");
  return data.url;
}

/**
 * Detaches `identity` from the current user. Supabase requires at least 2
 * remaining identities on the account — surface that in the UI rather than
 * letting this throw as the first the user hears of it.
 */
export async function unlinkOAuthIdentity(identity: UserIdentity): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw new Error(error.message);
}
