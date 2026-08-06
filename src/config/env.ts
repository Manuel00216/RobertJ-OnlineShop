import { z } from "zod";

/**
 * Single source of truth for environment variables.
 * Fails fast at module load so misconfiguration never reaches runtime code.
 *
 * Stripe keys are optional: the official payment path is COD + QR receipt
 * upload with manual verification (see DECISIONS.md -> ADR-008); Stripe is an
 * experimental spike (ADR-014), not a boot requirement. The app must run on
 * Supabase credentials alone — card payments simply stay unavailable until
 * Stripe keys are provided (see isStripeConfigured below).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
});

/**
 * Turns a Zod failure into an actionable setup message. A raw ZodError here
 * is useless — the fix is almost always "create .env.local".
 */
function formatEnvError(error: z.ZodError): never {
  const issues = z
    .flattenError(error)
    .fieldErrors as Record<string, string[] | undefined>;

  const lines = Object.entries(issues).map(([key, messages]) => {
    const detail = messages?.[0] ?? "invalid";
    const isMissing = detail.toLowerCase().includes("undefined");
    return `  - ${key}: ${isMissing ? "missing" : detail}`;
  });

  throw new Error(
    [
      "Invalid environment configuration:",
      ...lines,
      "",
      "Create .env.local from the template and fill in your Supabase values:",
      "  cp .env.example .env.local",
      "",
      "Find the URL and anon key in your Supabase dashboard under",
      "Project Settings → API. Restart the dev server after editing.",
    ].join("\n"),
  );
}

function parsePublicEnv() {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });

  if (!result.success) formatEnvError(result.error);
  return result.data;
}

/** Values safe to reference from Client Components. */
export const publicEnv = parsePublicEnv();

/**
 * Client-safe check for whether the (experimental, non-official) Stripe
 * payment path is available. Use this to hide/disable card-payment UI and
 * skip Stripe calls gracefully instead of failing at runtime.
 */
export const isStripeConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

/** Server-only values. Never import this from a Client Component. */
export function getServerEnv() {
  const result = serverEnvSchema.safeParse({
    ...publicEnv,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  });

  if (!result.success) formatEnvError(result.error);
  return result.data;
}

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
