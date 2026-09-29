/**
 * Predefined reasons offered when a seller/admin cancels an order from the
 * dashboard (`OrderStatusControl`) — distinct from `CANCELLATION_REASONS`
 * (the buyer's own set in `cancellation-reasons.constants.ts`), since the
 * two sides cancel for different reasons. Covers the shipped -> cancelled
 * failed-delivery case specifically, plus the earlier-stage reasons a
 * seller/admin can still act on. `"other"` is the same kind of sentinel —
 * selecting it reveals a required free-text field, and that text (not the
 * word "Other") is what's persisted as `cancellation_reason`.
 */
export const SELLER_CANCELLATION_REASONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "buyer_refused_delivery", label: "Buyer refused delivery" },
  { value: "buyer_unreachable", label: "Buyer unreachable / not home" },
  { value: "delivery_address_issue", label: "Delivery address issue" },
  { value: "item_unavailable", label: "Item no longer available" },
  { value: "buyer_requested", label: "Buyer requested cancellation" },
];

/** Sentinel value for the "Other" option — see the module doc comment above. */
export const OTHER_SELLER_CANCELLATION_REASON = "other";
