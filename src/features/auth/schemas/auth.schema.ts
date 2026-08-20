import { z } from "zod";

// Minimum length for a *new* password (sign-up, reset). Kept separate from
// signInSchema's rule below so raising this can't lock out accounts created
// under a previously-lower minimum.
const NEW_PASSWORD_MIN = 10;

/** The only providers enabled in the Supabase dashboard for this app. */
export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Cloudflare Turnstile token, required on the bot-abusable auth entry points. */
const captchaTokenSchema = z.string().min(1, "Verification failed. Please try again.");

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  // Deliberately not raised alongside NEW_PASSWORD_MIN: this only validates
  // input shape before handing off to Supabase, which is the real source of
  // truth for whether the password is correct — it must not reject a
  // legitimate, already-existing shorter password.
  password: z.string().min(8, "Password must be at least 8 characters."),
  captchaToken: captchaTokenSchema,
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

/**
 * Same as `forgotPasswordSchema` plus a captcha token — used only by
 * `requestPasswordResetAction`. Kept separate (rather than adding the token
 * to `forgotPasswordSchema` directly) because `resendVerificationAction`
 * reuses the base schema and has no widget of its own.
 */
export const requestPasswordResetSchema = forgotPasswordSchema.extend({
  captchaToken: captchaTokenSchema,
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
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
