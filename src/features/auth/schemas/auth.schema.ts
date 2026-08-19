import { z } from "zod";

// Minimum length for a *new* password (sign-up, reset). Kept separate from
// signInSchema's rule below so raising this can't lock out accounts created
// under a previously-lower minimum.
const NEW_PASSWORD_MIN = 10;

/** The only providers enabled in the Supabase dashboard for this app. */
export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  // Deliberately not raised alongside NEW_PASSWORD_MIN: this only validates
  // input shape before handing off to Supabase, which is the real source of
  // truth for whether the password is correct — it must not reject a
  // legitimate, already-existing shorter password.
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = signInSchema.extend({
  password: z
    .string()
    .min(NEW_PASSWORD_MIN, `Password must be at least ${NEW_PASSWORD_MIN} characters.`),
  fullName: z.string().trim().min(2, "Enter your full name."),
});

/** Forgot-password request: just the email to send the recovery link to. */
export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});

/** New-password form shown after following a recovery link. */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(NEW_PASSWORD_MIN, `Password must be at least ${NEW_PASSWORD_MIN} characters.`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Sign-in via Google/Facebook. `redirectTo` carries the post-login
 * destination through the provider round trip; re-validated with
 * `isInternalPath` before use (never trusted as-is).
 */
export const oauthSignInSchema = z.object({
  provider: z.enum(OAUTH_PROVIDERS),
  redirectTo: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
