/**
 * Checkout constants.
 *
 * `shippingFeeCentsPerSeller` is the shipping-fee source for checkout. The
 * schema has `orders.shipping_fee_cents` but **no shipping-rate table**, so the
 * fee is a flat constant per seller order (default 0 = free shipping). This is a
 * documented mapping, not a schema back-fill (see the module plan §7).
 */
export const CHECKOUT_CONSTANTS = {
  shippingFeeCentsPerSeller: 0,
  /**
   * This marketplace is domestic-only (no courier/shipping API — see SAD Out
   * of Scope), so the shipping-address "Country" field is locked to this
   * value rather than free text. Single source of truth for the schema
   * (`checkout.schema.ts`) and the form's default/locked value.
   */
  shippingCountry: "Philippines",
} as const;

export const CHECKOUT_COPY = {
  placeOrder: "Place order",
  placingOrder: "Placing order…",
  codLabel: "Cash on Delivery",
  codDescription: "Pay when your order arrives. Verification happens on delivery.",
  qrLabel: "QR Transfer",
  qrDescription: "Scan the seller's QR code and upload your receipt after placing your order.",
  qrNote: "You'll get payment instructions and can upload your receipt once your order is placed.",
  paymentSectionTitle: "Payment",
  emptyTitle: "Your cart is empty",
  emptyDescription: "Add items to your cart before checking out.",
  agreeNote: "By placing this order you agree to pay on delivery.",
} as const;
