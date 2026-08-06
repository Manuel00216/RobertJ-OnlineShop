import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Maps Postgres error codes (SQLSTATE) thrown by the service layer to friendly
 * copy, so a raw constraint/index message never reaches the UI (mirrors the
 * `mapAuthError` pattern in `features/auth/constants/auth-errors.ts`, keyed on
 * `.code` instead of a `.message` regex since these come from PostgREST/`pg`,
 * not Supabase Auth). Rules are checked in order; the first matching `code`
 * (and `test`, if present) wins.
 */
const KNOWN_ERRORS: Array<{
  code: string;
  test?: (error: PostgrestError) => boolean;
  message: string;
}> = [
  {
    code: "23505",
    test: (error) => /username/i.test(error.message),
    message: "That username is already taken.",
  },
  { code: "23505", message: "That value is already in use." },
  { code: "23514", message: "That value isn't valid." },
  { code: "23503", message: "That item no longer exists." },
];

/** Maps a Postgres error to friendly copy, or `fallback` when nothing matches. */
export function mapPostgresError(
  error: PostgrestError,
  fallback: string,
): string {
  for (const rule of KNOWN_ERRORS) {
    if (error.code === rule.code && (!rule.test || rule.test(error))) {
      return rule.message;
    }
  }
  return fallback;
}
