import { z } from "zod";

/**
 * A saved address's editable fields. `country` isn't here — same
 * domestic-only lock checkout already applies (`CHECKOUT_CONSTANTS.shippingCountry`),
 * so it's fixed server-side, never a form field.
 */
export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required.")
    .max(40, "Label must be 40 characters or fewer."),
  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name is required.")
    .max(120, "Recipient name must be 120 characters or fewer."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),
  region: z.string().trim().max(120).optional().default(""),
  province: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(1, "City/Municipality is required.").max(120),
  barangay: z.string().trim().max(120).optional().default(""),
  streetDetails: z
    .string()
    .trim()
    .min(1, "Street/House/Unit is required.")
    .max(160, "Street/House/Unit must be 160 characters or fewer."),
  postalCode: z
    .string()
    .trim()
    .min(1, "Postal code is required.")
    .max(20, "Postal code must be 20 characters or fewer."),
  // Deliberately no `isDefault` field here — the add/edit form never sets it
  // directly (an edit must never silently un-default an address just
  // because the caller omitted the field). `setDefaultAddress` is the sole,
  // dedicated path for changing which address is default; a brand-new
  // address becomes the default automatically only when it's the buyer's
  // first (see `queries.createAddress`).
});

export type AddressInput = z.infer<typeof addressSchema>;
