import "server-only";

import { cache } from "react";

import { USER_ROLES, type UserRole } from "@/constants/roles";
import { publicEnv } from "@/config/env";
import { DATABASE_TABLES } from "@/constants/database";
import { ROUTES } from "@/constants/routes";
import {
  ORDER_STATUS,
  PRODUCT_STATUS,
  type OrderStatus,
  type ProductCondition,
  type ProductStatus,
} from "@/constants/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  ProductListParams,
} from "@/features/products/types/product.types";
import type { Category } from "@/features/categories/types/category.types";
import type { LandingStat } from "@/features/landing/types/landing.types";
import {
  CANCELLABLE_ORDER_STATUSES,
  ORDER_STATUS_FLOW,
} from "@/features/orders/constants/order.constants";
import type {
  Order,
  OrderListParams,
  OrderSummary,
  ShippingAddress,
} from "@/features/orders/types/order.types";
import type { UpdateProfileInput } from "@/features/account/schemas/account.schema";
import type { Profile } from "@/features/account/types/account.types";

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
  status, featured, location, tags, category_id, seller_id, published_at,
  created_at, updated_at,
  product_images ( id, url, alt_text, sort_order ),
  seller:profiles!products_seller_id_fkey ( full_name, username ),
  category:categories!products_category_id_fkey ( name, slug )
`;

type ProductRowWithImages = Omit<ProductRow, "search_vector"> & {
  product_images: Pick<
    ProductImageRow,
    "id" | "url" | "alt_text" | "sort_order"
  >[];
  seller: Pick<ProfileRow, "full_name" | "username"> | null;
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

  let query = supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("status", params.status ?? PRODUCT_STATUS.active);

  if (params.search) {
    // Backed by the GIN trigram index on products.title.
    query = query.ilike("title", `%${params.search}%`);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.sellerId) {
    query = query.eq("seller_id", params.sellerId);
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

/** Inserts a product owned by the given seller. */
export async function createProduct(
  input: CreateProductInput,
  sellerId: string,
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
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  return toProduct(data as ProductRowWithImages);
}

/** Applies a partial update. RLS enforces seller ownership. */
export async function updateProduct(
  input: UpdateProductInput,
): Promise<Product> {
  const supabase = await createSupabaseServerClient();
  const { id, price, categoryId, description, location, ...rest } = input;

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
export async function archiveProduct(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(DATABASE_TABLES.PRODUCTS)
    .update({ status: PRODUCT_STATUS.archived })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive product: ${error.message}`);
  }
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
  id, order_number, seller_id, subtotal_cents, shipping_fee_cents, total_cents,
  currency, payment_status, order_status, shipping_address, notes, placed_at,
  paid_at, shipped_at, delivered_at, cancelled_at,
  seller:profiles!orders_seller_id_fkey ( full_name, username ),
  order_items (
    id, product_id, product_title, quantity, unit_price_cents, subtotal_cents,
    product:products!order_items_product_id_fkey ( slug, product_images ( url ) )
  )
`;

type OrderRowWithItems = Omit<OrderRow, "shipping_address"> & {
  shipping_address: Json;
  seller: Pick<ProfileRow, "full_name" | "username"> | null;
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
    sellerId: row.seller_id,
    sellerName: row.seller?.full_name ?? row.seller?.username ?? null,
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
    role: row.role,
  };
}

/**
 * The signed-in user's own profile row, including `phone` (readable because the
 * authenticated role holds a full-row SELECT grant — no RPC needed).
 */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select("id, full_name, username, avatar_url, phone, bio, role")
    .eq("id", userId)
    .maybeSingle();

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
  const { data, error } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .update({
      full_name: input.fullName || null,
      username: input.username || null,
      avatar_url: input.avatarUrl || null,
      phone: input.phone || null,
      bio: input.bio || null,
    })
    .eq("id", userId)
    .select("id, full_name, username, avatar_url, phone, bio, role")
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return toProfile(data);
}

// ============================================================================
// Auth / session
// ============================================================================

/** Absolute URL of the PKCE callback, optionally forwarding a post-auth path. */
function callbackUrl(next?: string) {
  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.authCallback}`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/** Current user with the profile row merged in, or null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
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

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Confirmation link lands on the PKCE callback, which sets the session.
      emailRedirectTo: callbackUrl(),
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
export async function sendPasswordResetEmail(email: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(ROUTES.resetPassword),
  });
  if (error) throw new Error(error.message);
}

/** Sets a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(newPassword: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
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
