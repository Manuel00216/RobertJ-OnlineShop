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
} as const;

export const CHECKOUT_COPY = {
  placeOrder: "Place order",
  placingOrder: "Placing order…",
  codLabel: "Cash on Delivery",
  codDescription: "Pay when your order arrives. Verification happens on delivery.",
  cardLabel: "Card",
  cardDescription: "Pay now securely with Stripe.",
  continueToPayment: "Continue to payment",
  payNow: "Pay now",
  processingPayment: "Processing payment…",
  paymentPending:
    "Your payment is still being processed. We'll confirm it by email and update your order shortly.",
  paymentSectionTitle: "Payment",
  emptyTitle: "Your cart is empty",
  emptyDescription: "Add items to your cart before checking out.",
  agreeNote: "By placing this order you agree to pay on delivery.",
} as const;
