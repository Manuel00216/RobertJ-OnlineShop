"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import { placeOrderAction } from "@/features/checkout/actions/checkout.actions";
import { CheckoutEmptyState } from "@/features/checkout/components/CheckoutEmptyState";
import { CheckoutGroupCard } from "@/features/checkout/components/CheckoutGroupCard";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import { PaymentMethodCard } from "@/features/checkout/components/PaymentMethodCard";
import { ShippingAddressForm } from "@/features/checkout/components/ShippingAddressForm";
import { CHECKOUT_CONSTANTS, CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import {
  shippingAddressSchema,
  type ShippingAddressInput,
} from "@/features/checkout/schemas/checkout.schema";
import type { PaymentMethod, PlaceOrderResult } from "@/features/checkout/types/checkout.types";
import { groupCartBySeller } from "@/features/checkout/utils/groupCartBySeller";
import type { ActionResult } from "@/types/action.types";

type FieldErrors = Record<string, string[] | undefined>;

const EMPTY_ADDRESS: ShippingAddressInput = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  country: CHECKOUT_CONSTANTS.shippingCountry,
  phone: "",
};

/**
 * The checkout flow: reads the guest cart, groups it by seller, collects a
 * shipping address (validated client-side then server-side), and submits to
 * `placeOrderAction`. Handles partial success explicitly — placed groups are
 * removed from the cart, failed groups stay with a clear reason. On full
 * success, hands off to the order-confirmation page rather than the raw
 * order-history list.
 */
export function CheckoutForm() {
  const router = useRouter();
  const { items, clear, removeMany } = useCart();

  const groups = useMemo(() => groupCartBySeller(items), [items]);

  const [address, setAddress] = useState<ShippingAddressInput>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return <CheckoutEmptyState />;
  }

  const grandSubtotalCents = groups.reduce(
    (sum, group) => sum + group.subtotalCents,
    0,
  );
  const grandShippingCents = groups.reduce(
    (sum, group) => sum + group.shippingFeeCents,
    0,
  );
  const grandTotalCents = grandSubtotalCents + grandShippingCents;
  // Assumes every group shares one currency (PHP) — this marketplace is
  // single-market/PHP-only by design (see siteConfig, README), not a
  // multi-currency checkout. A cart mixing currencies isn't a supported case.
  const currency = groups[0]?.currency;

  function handleChange(field: keyof ShippingAddressInput, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handlePlaceOrder() {
    setFormError(null);
    setResult(null);

    const parsed = shippingAddressSchema.safeParse(address);
    if (!parsed.success) {
      setFieldErrors(
        z.flattenError(parsed.error).fieldErrors as FieldErrors,
      );
      return;
    }

    startTransition(async () => {
      const actionResult: ActionResult<PlaceOrderResult> = await placeOrderAction({
        address: parsed.data,
        groups: groups.map((group) => ({
          sellerId: group.sellerId,
          sellerName: group.sellerName,
          items: group.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        })),
      });

      if (!actionResult.success) {
        setFormError(actionResult.error);
        if (actionResult.fieldErrors) setFieldErrors(actionResult.fieldErrors);
        return;
      }

      const { created, failed } = actionResult.data;
      setResult(actionResult.data);
      const placedProductIds = created.flatMap((order) => order.productIds);

      if (failed.length === 0) {
        // Full success: clear the cart and hand off to the confirmation page.
        clear();
        const orderIds = created.map((order) => order.orderId);
        router.push(`${ROUTES.checkoutConfirmation}?orders=${orderIds.join(",")}`);
        return;
      }

      // Partial success: drop only placed items; keep failed ones to fix/retry.
      if (placedProductIds.length > 0) removeMany(placedProductIds);
    });
  }

  const partialFailed = result?.failed ?? [];

  return (
    <form
      className="flex flex-col gap-8"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        handlePlaceOrder();
      }}
    >
      {result && result.failed.length > 0 ? (
        <div className="flex flex-col gap-3">
          {result.created.length > 0 ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-rj-green"
            >
              Some orders were placed. The items we couldn&apos;t order are still
              in your cart.
            </p>
          ) : null}
          {partialFailed.map((failed) => (
            <ErrorState
              key={failed.sellerId}
              title={`Couldn't order from ${failed.sellerName ?? "this seller"}`}
              message={failed.reason}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.orders}
              className="text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
            >
              View my orders
            </Link>
            {partialFailed.length > 0 ? (
              <Link
                href={ROUTES.cart}
                className="text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
              >
                Adjust items still in your cart
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section aria-label="Your order" className="flex flex-col gap-6">
            {groups.map((group) => (
              <CheckoutGroupCard key={group.sellerId} group={group} />
            ))}
          </section>

          <ShippingAddressForm
            values={address}
            errors={fieldErrors}
            onChange={handleChange}
          />

          <PaymentMethodCard method={method} onChange={setMethod} />
          {method === "qr_upload" ? (
            <p className="text-xs text-rj-gray-600">{CHECKOUT_COPY.qrNote}</p>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-5">
            <CheckoutTotals
              title="Order total"
              subtotalCents={grandSubtotalCents}
              shippingFeeCents={grandShippingCents}
              totalCents={grandTotalCents}
              currency={currency ?? "PHP"}
            />
          </div>

          <Button
            type="submit"
            variant="rj"
            size="rj"
            isLoading={isPending}
            className="w-full"
          >
            {isPending ? CHECKOUT_COPY.placingOrder : CHECKOUT_COPY.placeOrder}
          </Button>

          {formError ? (
            <ErrorState title="Couldn't place your order" message={formError} />
          ) : null}

          <p className="text-center text-xs text-rj-gray-600">
            {CHECKOUT_COPY.agreeNote}
          </p>
        </aside>
      </div>
    </form>
  );
}
