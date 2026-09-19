/**
 * Predefined reasons offered when a buyer cancels their own order
 * (`CancelOrderButton`). `"other"` is a sentinel, not a real value sent to
 * the server — selecting it reveals a required free-text field, and the
 * text itself (not the word "Other") is what's persisted as
 * `cancellation_reason`.
 */
export const CANCELLATION_REASONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "change_address", label: "Need to change delivery address" },
  { value: "change_payment", label: "Need to change payment method" },
  { value: "ordered_by_mistake", label: "Ordered by mistake" },
  { value: "found_better_price", label: "Found a better price elsewhere" },
  { value: "wont_arrive_in_time", label: "Item won't arrive on time" },
  { value: "changed_mind", label: "Changed my mind" },
];

/** Sentinel value for the "Other" option — see the module doc comment above. */
export const OTHER_CANCELLATION_REASON = "other";
