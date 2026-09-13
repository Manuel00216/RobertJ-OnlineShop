import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { USER_ROLES } from "@/constants/roles";
import { OrderCard } from "@/features/orders/components/OrderCard";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getBuyerOrder,
  getShopNamesBySellerIds,
  requireSessionUser,
} from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Order confirmed" };

interface CheckoutConfirmationPageProps {
  searchParams: Promise<{ orders?: string }>;
}

/**
 * Post-checkout summary — `placeOrderAction` created one order per seller
 * group (ADR-012), and `CheckoutForm` redirects here with their ids so the
 * customer sees exactly what was placed, instead of landing straight on the
 * full order-history list. Ownership is re-checked per order via
 * `getBuyerOrder` (same as the order-detail page), never trusted from the
 * query string — unchanged from before this page's visual redesign.
 */
export default async function CheckoutConfirmationPage({
  searchParams,
}: CheckoutConfirmationPageProps) {
  const { orders: ordersParam } = await searchParams;
  const user = await requireSessionUser();

  const orderIds = (ordersParam ?? "").split(",").filter(Boolean);
  if (orderIds.length === 0) notFound();

  const orders = (
    await Promise.all(orderIds.map((id) => getBuyerOrder(id, user.id)))
  ).filter((order) => order !== null);

  if (orders.length === 0) notFound();

  // Real shop name per order — same resolution the PDP/order-detail pages
  // already use (`shop_users` join, not `products.shop_id` — see TD-1),
  // falling back to the seller's own name only for a genuine `seller`
  // account, else a generic label. No new query: `getShopNamesBySellerIds`
  // already exists and is already used elsewhere for this exact purpose.
  const sellerIds = [...new Set(orders.map((order) => order.sellerId))];
  const shopNames = await getShopNamesBySellerIds(sellerIds).catch(
    () => new Map<string, string>(),
  );
  const shopLabel = (order: (typeof orders)[number]) =>
    shopNames.get(order.sellerId) ??
    (order.sellerRole === USER_ROLES.seller ? order.sellerName : null) ??
    "RobertJ Seller";

  const isMultiShop = orders.length > 1;
  const grandTotalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const currency = orders[0]?.currency ?? "PHP";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rj-green/10">
          <CheckCircle2 className="h-9 w-9 text-rj-green" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-serif text-3xl leading-[1.05] text-rj-black">
            {isMultiShop ? "Orders placed!" : "Order placed!"}
          </h1>
          <p className="mt-2 text-sm text-rj-gray-600">
            {isMultiShop
              ? `Your order was split into ${orders.length} separate orders — one per shop — and we'll keep you updated as each is fulfilled.`
              : "We've received your order and will keep you updated as it's fulfilled."}
          </p>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-4 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-rj-gray-600">
            {isMultiShop ? `Total across ${orders.length} orders` : "Total"}
          </span>
          <span className="text-base font-bold text-rj-black">
            {formatCurrency(grandTotalCents, currency)}
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-3 text-left">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard
              order={order}
              subtitle={isMultiShop ? shopLabel(order) : undefined}
              viewLabel="View Order"
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href={ROUTES.orders}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        >
          View My Orders
        </Link>
        <Link
          href={ROUTES.products}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
