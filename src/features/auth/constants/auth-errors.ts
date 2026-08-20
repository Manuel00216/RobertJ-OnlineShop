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
  [/captcha/i, "Verification failed. Please try again."],
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

/**
 * Maps the `/auth/callback` route's `?error=` query code to friendly copy.
 * Parallel to `mapAuthError`: that one maps a thrown Supabase message from a
 * Server Action, this one maps a query-string code from an OAuth provider
 * redirect (there is no thrown `Error` object at that point, just a code).
 */
const OAUTH_CALLBACK_ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  oauth_start_failed: "Something went wrong starting that sign-in. Please try again.",
  // `server_error` is GoTrue's standard OAuth2 error code for a failed
  // provider exchange, including "no email from Facebook" — confirmed from
  // community reports, not an exhaustive Supabase enum. Verify the exact
  // code against a real no-email Facebook test account during QA and adjust
  // this key if it differs.
  server_error:
    "We couldn't get an email address from that provider. Please confirm an email on your account there, or sign in with Google or your password instead.",
  auth_callback_failed: "Something went wrong finishing sign-in. Please try again.",
};

export function mapOAuthCallbackError(code: string | null): string | null {
  if (!code) return null;
  return OAUTH_CALLBACK_ERRORS[code] ?? OAUTH_CALLBACK_ERRORS.auth_callback_failed;
}
