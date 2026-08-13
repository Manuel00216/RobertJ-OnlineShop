import type { OrderStatus } from "@/constants/status";

/** Time bucket granularity for the sales trend. Mirrors the RPC's accepted values. */
export type ReportGranularity = "day" | "week" | "month";

/**
 * The report query, as resolved from the dashboard's search params. Dates are
 * `YYYY-MM-DD` calendar dates interpreted in Asia/Manila (the single reporting
 * axis — see the migration header). `shopId` is honoured only for admins; the
 * RPC ignores it for sellers.
 */
export interface ReportFilters {
  from: string;
  to: string;
  granularity: ReportGranularity;
  shopId: string | null;
}

/** One-row KPI summary. All monetary values are integer centavos. */
export interface SalesSummary {
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  revenueCents: number;
  unitsSold: number;
  avgOrderValueCents: number;
  codPaidOrders: number;
  qrPaidOrders: number;
  pendingPaymentOrders: number;
}

/** A single point on the sales trend. `bucket` is a `YYYY-MM-DD` Manila date. */
export interface SalesTrendPoint {
  bucket: string;
  orderCount: number;
  revenueCents: number;
}

/** Count of orders in a given fulfilment status within the range. */
export interface OrderStatusCount {
  status: OrderStatus;
  orderCount: number;
}

/** A best-selling product row (units across placed orders; revenue over paid). */
export interface TopProduct {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}
