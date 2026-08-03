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
    /already registered|user already exists/i,
    "An account with this email already exists. Try signing in.",
  ],
  [/rate limit|too many requests|429/i, "Too many attempts. Please try again later."],
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
