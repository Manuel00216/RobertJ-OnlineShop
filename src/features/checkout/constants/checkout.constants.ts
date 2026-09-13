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
  /**
   * Single source of truth for the checkout delivery-method display
   * (`ShippingMethodCard`). There's only one method today — no courier API,
   * no live tracking (SAD Out of Scope) — so this is a static estimate, not
   * data sourced from a real logistics integration.
   */
  standardDeliveryLabel: "Standard Delivery",
  standardDeliveryEstimate: "Estimated delivery: 3–5 business days",
} as const;

export const CHECKOUT_COPY = {
  placeOrder: "Place order",
  placingOrder: "Placing order…",
  codLabel: "Cash on Delivery",
  codDescription: "Pay when your order arrives. The seller marks it collected once received.",
  onlineLabel: "Online Payment",
  onlineDescription:
    "Pay securely via GCash, Maya, or Card — completed from your order page after checkout.",
  orderSectionTitle: "Your Order",
  deliveryAddressSectionTitle: "Delivery Address",
  paymentSectionTitle: "Payment",
  shippingSectionTitle: "Shipping",
  shippingFreeLabel: "Free",
  notesSectionTitle: "Order Notes",
  notesPlaceholder: "Optional message to the seller (e.g. delivery instructions)…",
  emptyTitle: "Your cart is empty",
  emptyDescription: "Add items to your cart before checking out.",
  nothingSelectedTitle: "Nothing selected",
  nothingSelectedDescription:
    "Go back to your cart and check the items you'd like to order.",
  agreeNote:
    "Cash on Delivery needs no action — pay online (GCash, Maya, or Card) from your order page after checkout.",
  multiShopNoticePrefix: "This will be placed as",
  multiShopNoticeSuffix: "separate orders — one per shop.",
  addressPrefilledNote:
    "Using the address from your last order — edit any field if this delivery is going somewhere else.",
  defaultAddressNote:
    "Using your default saved address — edit any field, or tap Change to pick another.",
  changeAddressLabel: "Change",
  addNewAddressNote: "Enter a delivery address below.",
  saveAddressLabel: "Save this address to my account",
} as const;
