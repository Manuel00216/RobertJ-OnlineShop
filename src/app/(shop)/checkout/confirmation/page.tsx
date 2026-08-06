import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { OrderCard } from "@/features/orders/components/OrderCard";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { cn } from "@/lib/utils/cn";
import { getBuyerOrder, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Order confirmed" };

interface CheckoutConfirmationPageProps {
  searchParams: Promise<{ orders?: string }>;
}

/**
 * Post-checkout summary — `placeOrderAction` created one order per seller
 * group, and `CheckoutForm` redirects here with their ids so the customer
 * sees what was actually placed, instead of landing straight on the full
 * order-history list. Ownership is re-checked per order via `getBuyerOrder`
 * (same as the order-detail page), not trusted from the query string.
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

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="Thank you"
        title={
          orders.length > 1 ? "Your orders are confirmed" : "Your order is confirmed"
        }
        description="We've received your order and will keep you updated as it's fulfilled."
      />

      <ul className="flex flex-col gap-3">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Link
          href={ROUTES.orders}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        >
          View my orders
        </Link>
        <Link
          href={ROUTES.products}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
