import type { UserRole } from "@/constants/roles";
import type { OrderStatus, PaymentStatus } from "@/constants/status";

/**
 * Delivery address captured at checkout and snapshotted on the order
 * (`orders.shipping_address` jsonb). Required keys per the schema CHECK:
 * `full_name, line1, city, postal_code, country`; `line2`/`phone` are optional.
 */
export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  /** Structured fields added in the Phase 2 saved-address work — optional
   * because historical snapshots (and manually-typed addresses that left
   * them blank) never had them. Extra keys on the same jsonb object; no
   * schema/CHECK-constraint change was needed to add them. */
  barangay: string | null;
  city: string;
  province: string | null;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

/**
 * One immutable line item. `productTitle`, `unitPriceCents`, and `subtotalCents`
 * are snapshots taken at checkout; `productSlug`/`imageUrl` are joined live from
 * the product when RLS still exposes it (a sold/archived product resolves to null
 * — the snapshot fields carry the display).
 */
export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  productSlug: string | null;
  imageUrl: string | null;
  /** Snapshot reference to the purchased variant, or null for a non-variant line (including every historical order placed before Phase 3c). */
  variantId: string | null;
  /** Snapshot display label (e.g. "Blue / Medium") captured at purchase time — never re-derived from product_variants. */
  variantLabel: string | null;
}

/** Domain model returned by the order service to the rest of the app. */
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: ShippingAddress | null;
  notes: string | null;
  buyerId: string;
  /** Buyer display name (full name, falling back to username), or null — shown on the dashboard, not the buyer's own view. */
  buyerName: string | null;
  sellerId: string;
  /** Seller display name (full name, falling back to username), or null. */
  sellerName: string | null;
  /**
   * The `seller_id` profile's current role — see `Product.sellerRole` for
   * why this matters: `create_order` doesn't require `seller_id` to be a
   * `seller` account, so a "Sold by" label must gate on this before showing
   * `sellerName` (an admin-authored product's order should never expose the
   * admin's personal name).
   */
  sellerRole: UserRole | null;
  items: OrderItem[];
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  /** True while the buyer may still cancel (status in `CANCELLABLE_ORDER_STATUSES`). */
  cancellable: boolean;
  /** Set when this order was placed as part of a multi-seller, one-combined-payment checkout; null for COD and single-seller orders. */
  checkoutGroupId: string | null;
}

/** Filters accepted by the buyer order listing query. */
export interface OrderListParams {
  page: number;
  pageSize: number;
  /** Order-ID search (ilike `order_number`), per the proposal storyboard. */
  search?: string;
  /** Optional status filter, driven by the chips UI. */
  status?: OrderStatus;
}

/** Overview-hub payload: per-status counts + the 5 most recent orders. */
export interface OrderSummary {
  statusCounts: Record<OrderStatus, number>;
  recentOrders: Order[];
}
