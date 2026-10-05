import type { PaymentMethod } from "@/features/checkout/types/checkout.types";
import type { ShippingAddressInput, XenditChannel } from "@/features/checkout/schemas/checkout.schema";

interface FingerprintItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface FingerprintGroup {
  sellerId: string;
  items: FingerprintItem[];
}

export interface CheckoutFingerprintInput {
  address: ShippingAddressInput;
  groups: FingerprintGroup[];
  notes?: string;
  paymentMethod: PaymentMethod;
  xenditChannel?: XenditChannel;
}

/**
 * Canonical fingerprint of exactly what a checkout submission sends to
 * `placeOrderAction`. Two submissions with identical content always produce
 * the same string regardless of incidental array ordering (cart line order,
 * seller map iteration order) — used to tell a genuine retry (same
 * fingerprint, reuse the idempotency key) apart from a retry after the buyer
 * edited the cart/address/payment choice (different fingerprint, needs a
 * fresh key so it can't replay stale pre-edit order data).
 */
export function buildCheckoutFingerprint(input: CheckoutFingerprintInput): string {
  const groups = [...input.groups]
    .map((group) => ({
      sellerId: group.sellerId,
      items: [...group.items]
        .map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }))
        .sort((a, b) =>
          `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`),
        ),
    }))
    .sort((a, b) => a.sellerId.localeCompare(b.sellerId));

  return JSON.stringify({
    address: input.address,
    groups,
    notes: input.notes ?? null,
    paymentMethod: input.paymentMethod,
    xenditChannel: input.xenditChannel ?? null,
  });
}
