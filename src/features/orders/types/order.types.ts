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
  city: string;
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
  sellerId: string;
  /** Seller display name (full name, falling back to username), or null. */
  sellerName: string | null;
  /** Seller's receiving QR code image, shown to the buyer for a QR payment. */
  sellerPaymentQrUrl: string | null;
  items: OrderItem[];
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  /** True while the buyer may still cancel (status in `CANCELLABLE_ORDER_STATUSES`). */
  cancellable: boolean;
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
