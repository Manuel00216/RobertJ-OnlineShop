"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import { getSelectedItems } from "@/features/cart/utils/cart-reducer";
import { createAddressAction } from "@/features/addresses/actions/address.actions";
import type { Address } from "@/features/addresses/types/address.types";
import { placeOrderAction } from "@/features/checkout/actions/checkout.actions";
import { AddressPicker } from "@/features/checkout/components/AddressPicker";
import { CheckoutEmptyState } from "@/features/checkout/components/CheckoutEmptyState";
import { CheckoutGroupCard } from "@/features/checkout/components/CheckoutGroupCard";
import { CheckoutTotals } from "@/features/checkout/components/CheckoutTotals";
import { OrderNotesField } from "@/features/checkout/components/OrderNotesField";
import { PaymentMethodCard } from "@/features/checkout/components/PaymentMethodCard";
import { ShippingAddressForm } from "@/features/checkout/components/ShippingAddressForm";
import { ShippingMethodCard } from "@/features/checkout/components/ShippingMethodCard";
import { CHECKOUT_CONSTANTS, CHECKOUT_COPY } from "@/features/checkout/constants/checkout.constants";
import {
  shippingAddressSchema,
  type ShippingAddressInput,
} from "@/features/checkout/schemas/checkout.schema";
import type { PaymentMethod, PlaceOrderResult } from "@/features/checkout/types/checkout.types";
import { addressToShippingInput } from "@/features/checkout/utils/addressMapping";
import { groupCartBySeller } from "@/features/checkout/utils/groupCartBySeller";
import type { ActionResult } from "@/types/action.types";

type FieldErrors = Record<string, string[] | undefined>;
type AddressSource = "saved" | "last-order" | "profile" | "new" | "empty";

const EMPTY_ADDRESS: ShippingAddressInput = {
  fullName: "",
  line1: "",
  line2: "",
  barangay: "",
  city: "",
  province: "",
  region: "",
  postalCode: "",
  country: CHECKOUT_CONSTANTS.shippingCountry,
  phone: "",
};

export interface CheckoutFormProps {
  /** The signed-in buyer's saved addresses — see `checkout/page.tsx`. Empty when they have none yet. */
  savedAddresses: Address[];
  /** Server-resolved starting values: default saved address, else last order's address, else profile name/phone. Omitted when the buyer has none of those. */
  initialAddress?: ShippingAddressInput;
  /** Which of the three prefill sources produced `initialAddress` — drives which hint (if any) is shown. */
  initialAddressSource?: AddressSource;
  /** The saved address `initialAddress` came from, when the source is "saved" — pre-selects it in the picker. */
  initialSelectedAddressId?: string | null;
}

/**
 * The checkout flow: reads the guest cart, groups it by seller, collects a
 * shipping address (validated client-side then server-side), and submits to
 * `placeOrderAction`. Handles partial success explicitly — placed groups are
 * removed from the cart, failed groups stay with a clear reason. On full
 * success, hands off to the order-confirmation page rather than the raw
 * order-history list. The address field starts from `initialAddress` when
 * the page provided one, but stays fully editable — a buyer can overwrite
 * any or all of it, or use "Change" to pick a different saved address.
 */
export function CheckoutForm({
  savedAddresses,
  initialAddress,
  initialAddressSource = "empty",
  initialSelectedAddressId = null,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, removeMany, selectedIds } = useCart();

  // Checkout only ever places an order for the cart page's selected
  // items (selective checkout) — deselected lines stay in the cart
  // untouched. `placeOrderAction`/`create_order` are unchanged; this only
  // changes which items are handed to them.
  const checkoutItems = useMemo(
    () => getSelectedItems(items, selectedIds),
    [items, selectedIds],
  );
  const groups = useMemo(() => groupCartBySeller(checkoutItems), [checkoutItems]);

  const [address, setAddress] = useState<ShippingAddressInput>(
    initialAddress ?? EMPTY_ADDRESS,
  );
  const [addressSource, setAddressSource] = useState<AddressSource>(initialAddressSource);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    initialSelectedAddressId,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return <CheckoutEmptyState reason="empty" />;
  }
  if (checkoutItems.length === 0) {
    return <CheckoutEmptyState reason="nothing-selected" />;
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

  function handleSelectAddress(selected: Address) {
    setAddress(addressToShippingInput(selected));
    setSelectedAddressId(selected.id);
    setAddressSource("saved");
    setSaveNewAddress(false);
    setFieldErrors({});
    setShowPicker(false);
  }

  function handleSelectNewAddress() {
    setAddress(EMPTY_ADDRESS);
    setSelectedAddressId(null);
    setAddressSource("new");
    setFieldErrors({});
    setShowPicker(false);
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
      // Best-effort, independent of order placement — a save failure here
      // must never block checkout. Only offered when the buyer isn't
      // already using one of their saved addresses.
      if (saveNewAddress && selectedAddressId === null) {
        void createAddressAction({
          label: "Home",
          recipientName: parsed.data.fullName,
          phone: parsed.data.phone || "",
          region: parsed.data.region || "",
          province: parsed.data.province || "",
          city: parsed.data.city,
          barangay: parsed.data.barangay || "",
          streetDetails: parsed.data.line2
            ? `${parsed.data.line1}, ${parsed.data.line2}`
            : parsed.data.line1,
          postalCode: parsed.data.postalCode,
        }).catch(() => {});
      }

      const actionResult: ActionResult<PlaceOrderResult> = await placeOrderAction({
        address: parsed.data,
        groups: groups.map((group) => ({
          sellerId: group.sellerId,
          sellerName: group.sellerName,
          items: group.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        })),
        notes: notes.trim() || undefined,
      });

      if (!actionResult.success) {
        setFormError(actionResult.error);
        if (actionResult.fieldErrors) setFieldErrors(actionResult.fieldErrors);
        return;
      }

      const { created, failed } = actionResult.data;
      setResult(actionResult.data);
      const placedLines = created.flatMap((order) => order.lines);

      if (failed.length === 0) {
        // Full success: remove exactly the items that were just ordered —
        // not the whole cart, since deselected lines were never part of
        // this checkout and should stay put — then hand off to confirmation.
        removeMany(checkoutItems);
        const orderIds = created.map((order) => order.orderId);
        router.push(`${ROUTES.checkoutConfirmation}?orders=${orderIds.join(",")}`);
        return;
      }

      // Partial success: drop only placed items; keep failed ones to fix/retry.
      if (placedLines.length > 0) removeMany(placedLines);
    });
  }

  const partialFailed = result?.failed ?? [];
  const addressHint =
    addressSource === "saved"
      ? CHECKOUT_COPY.defaultAddressNote
      : addressSource === "last-order"
        ? CHECKOUT_COPY.addressPrefilledNote
        : null;
  // Offered whenever the current address isn't already one of the buyer's
  // saved ones — covers both an explicit "+ Add New Address" pick and a
  // first-time buyer with no saved addresses at all.
  const showSaveAddressOption = selectedAddressId === null;

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

          {savedAddresses.length > 0 ? (
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
                Delivery address
              </p>
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                aria-expanded={showPicker}
                className="text-xs font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
              >
                {showPicker ? "Hide" : CHECKOUT_COPY.changeAddressLabel}
              </button>
            </div>
          ) : null}

          {showPicker ? (
            <AddressPicker
              addresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={handleSelectAddress}
              onSelectNew={handleSelectNewAddress}
            />
          ) : null}

          {addressHint ? (
            <p className="text-xs text-rj-gray-600">{addressHint}</p>
          ) : null}
          <ShippingAddressForm
            values={address}
            errors={fieldErrors}
            onChange={handleChange}
          />

          {showSaveAddressOption ? (
            <label className="flex items-center gap-2 px-1 text-xs font-medium text-rj-gray-600">
              <input
                type="checkbox"
                checked={saveNewAddress}
                onChange={(event) => setSaveNewAddress(event.target.checked)}
                className="h-4 w-4 shrink-0 accent-rj-red"
              />
              {CHECKOUT_COPY.saveAddressLabel}
            </label>
          ) : null}

          <ShippingMethodCard />

          <PaymentMethodCard method={method} onChange={setMethod} />

          <OrderNotesField
            value={notes}
            onChange={setNotes}
            errors={fieldErrors.notes}
          />
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

          {groups.length > 1 ? (
            <p
              role="note"
              className="rounded-xl bg-rj-gray-50 px-3 py-2 text-xs font-medium text-rj-gray-600"
            >
              {CHECKOUT_COPY.multiShopNoticePrefix} {groups.length}{" "}
              {CHECKOUT_COPY.multiShopNoticeSuffix}
            </p>
          ) : null}

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
