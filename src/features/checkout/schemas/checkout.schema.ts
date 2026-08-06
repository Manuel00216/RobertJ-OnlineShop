import { z } from "zod";

import { CHECKOUT_CONSTANTS } from "@/features/checkout/constants/checkout.constants";
import { uuidSchema } from "@/lib/validations/common.schema";

/**
 * Shipping address (camelCase domain shape). The DB snapshot CHECK requires
 * `full_name, line1, city, postal_code, country`; line2/phone are optional and
 * are mapped to snake_case at the service boundary (`queries.createOrder`).
 */
export const shippingAddressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name is required.")
    .max(120, "Full name must be 120 characters or fewer."),
  line1: z
    .string()
    .trim()
    .min(1, "Street address is required.")
    .max(120, "Street address must be 120 characters or fewer."),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(1, "City is required.").max(120),
  postalCode: z
    .string()
    .trim()
    .min(1, "Postal code is required.")
    .max(20, "Postal code must be 20 characters or fewer."),
  // Domestic-only marketplace (no courier/shipping API) — locked server-side,
  // not just in the UI, since the client is never trusted for this.
  country: z.literal(CHECKOUT_CONSTANTS.shippingCountry),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number.")
    // Without this, an empty string (the field's own default/empty state,
    // not `undefined`) fails the regex instead of being treated as "not
    // provided" — matches account.schema.ts's `phone`, the same fix already
    // established in this codebase.
    .or(z.literal(""))
    .default(""),
});

/** One line to order: product + quantity. The RPC re-validates stock/price. */
export const checkoutItemSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1).max(999),
});

export const checkoutGroupSchema = z.object({
  sellerId: uuidSchema,
  sellerName: z.string().nullable().optional(),
  items: z.array(checkoutItemSchema).min(1, "A group must contain at least one item."),
});

/** Payload for `placeOrderAction`. */
export const placeOrderSchema = z.object({
  address: shippingAddressSchema,
  groups: z.array(checkoutGroupSchema).min(1, "Your cart is empty."),
});

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type CheckoutGroupInput = z.infer<typeof checkoutGroupSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
