import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { CheckoutResumePanel } from "@/features/checkout/components/CheckoutResumePanel";
import type { XenditChannel } from "@/features/checkout/schemas/checkout.schema";
import * as queries from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Complete Payment" };

interface CheckoutResumePageProps {
  params: Promise<{ orderId: string }>;
}

/**
 * Checkout's payment workspace for an order that already exists — the ONLY
 * place buyer payment initiation, retry, resume, or channel-switching is
 * allowed to happen (see docs/payment-ux-architecture-audit.md). Orders may
 * only navigate here; it never renders `PaymentRecoveryPanel` itself.
 */
export default async function CheckoutResumePage({ params }: CheckoutResumePageProps) {
  const { orderId } = await params;
  const user = await queries.requireSessionUser();
  const order = await queries.getBuyerOrder(orderId, user.id);

  if (!order) notFound();

  // Nothing to resume for COD, a cancelled order, or a payment that's
  // already resolved (paid/refunded) — land on the order's own page instead
  // of a payment workspace with nothing left to do. Mirrors the same
  // conditions `buyer_order_lifecycle`'s "to_pay" bucket already gates on.
  if (
    order.paymentMethod !== "xendit" ||
    order.status === "cancelled" ||
    !(order.paymentStatus === "pending" || order.paymentStatus === "failed")
  ) {
    redirect(ROUTES.orderDetail(order.id));
  }

  const [activePayment, groupSize] = await Promise.all([
    queries.getActivePaymentForOrder(order.id).catch(() => null),
    order.checkoutGroupId
      ? queries
          .getOrderIdsForCheckoutGroup(order.checkoutGroupId)
          .then((ids) => ids.length)
          .catch(() => 1)
      : Promise.resolve(1),
  ]);

  const initialChannel: XenditChannel =
    (activePayment?.paymentChannel as XenditChannel | null) ?? "GCASH";
  // Safe to offer a different payment method only once the current channel
  // is definitively resolved (failed) or nothing has ever reached Xendit yet
  // (no payments row at all) — never while an attempt might still be
  // in-flight and could still resolve successfully on its own. The action
  // layer (`createXendit*Action`) enforces this same rule server-side too —
  // this only controls whether the picker is offered.
  const canChangeChannel = order.paymentStatus === "failed" || activePayment === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-rj-gray-100 pb-3">
        <h1 className="text-xl font-semibold text-rj-black">Checkout</h1>
      </div>
      <CheckoutResumePanel
        orderId={order.id}
        checkoutGroupId={order.checkoutGroupId}
        groupSize={groupSize}
        orderNumber={order.orderNumber}
        paymentStatus={order.paymentStatus as "pending" | "failed"}
        initialChannel={initialChannel}
        canChangeChannel={canChangeChannel}
        failureReason={activePayment?.failureReason ?? null}
        subtotalCents={order.subtotalCents}
        shippingFeeCents={order.shippingFeeCents}
        totalCents={order.totalCents}
        currency={order.currency}
        ordersUrl={ROUTES.orders}
      />
    </div>
  );
}
