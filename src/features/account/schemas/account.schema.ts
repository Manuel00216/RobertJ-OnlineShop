import { z } from "zod";

/**
 * Editable profile fields, mirroring the `profiles` column CHECKs:
 * `full_name` 1–120, `username ^[a-z0-9_]{3,30}$`, `phone ^\+?[0-9 ()-]{7,20}$`,
 * `avatar_url ^https?://`, `bio` ≤ 500. Empty strings are valid inputs and are
 * normalised to `null` on write (the columns are nullable).
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(120, "Full name must be 120 characters or fewer."),
  username: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "3–30 characters: lowercase letters, numbers, underscores.",
    )
    .or(z.literal(""))
    .default(""),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number.")
    .or(z.literal(""))
    .default(""),
  avatarUrl: z
    .string()
    .trim()
    .url("Enter a valid URL (https://…).")
    .max(500, "Avatar URL must be 500 characters or fewer.")
    .or(z.literal(""))
    .default(""),
  bio: z
    .string()
    .trim()
    .max(500, "Bio must be 500 characters or fewer.")
    .default(""),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
