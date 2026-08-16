/**
 * Server-side error mapping for auth actions (frozen UI/UX spec §9.1).
 *
 * Every action catch routes through `mapAuthError` so users never see a raw
 * Supabase message (e.g. "Email not confirmed"), which both reads badly and
 * leaks account state. `ActionResult` and the action architecture are
 * unchanged — only the copy is normalised here.
 */
const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Invalid email or password."],
  [
    /email not confirmed|unverified/i,
    "Please verify your email address. We sent a link to your inbox.",
  ],
  [
    // Deliberately generic: doesn't confirm the email is registered (matches
    // the anti-enumeration design already used by requestPasswordResetAction).
    /already registered|user already exists/i,
    "Couldn't create your account with those details. If you already have an account, try signing in instead.",
  ],
  [/rate limit|too many requests|429/i, "Too many attempts. Please try again later."],
  [
    /password reset link has expired/i,
    "This password reset link has expired. Please request a new one.",
  ],
];

const FALLBACK = "Something went wrong. Please try again.";

/** Maps a thrown error (typically a Supabase message) to friendly generic copy. */
export function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, copy] of KNOWN_ERRORS) {
    if (pattern.test(message)) return copy;
  }
  return FALLBACK;
}
