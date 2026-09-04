import "server-only";

/**
 * Error-hygiene helpers for the service layer (audit finding F-B1).
 *
 * Raw PostgREST / `pg` / Storage error messages expose DB internals — table,
 * column and constraint names, "permission denied for table …", RLS-violation
 * text — which must never reach the client through `ActionResult.error`. These
 * helpers log the full raw error server-side (for diagnostics) and return an
 * Error whose message is safe to surface.
 */

/** Fields we log; common to Postgrest/Storage/Auth error objects. */
type LoggableError = {
  message: string | null;
  code: string | number | null;
  details: string | null;
  hint: string | null;
};

function extract(error: unknown): LoggableError {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : null,
      code:
        typeof e.code === "string" || typeof e.code === "number"
          ? e.code
          : null,
      details: typeof e.details === "string" ? e.details : null,
      hint: typeof e.hint === "string" ? e.hint : null,
    };
  }
  return { message: typeof error === "string" ? error : null, code: null, details: null, hint: null };
}

/**
 * Logs the full raw error server-side and returns an Error carrying ONLY
 * `context` — a friendly, caller-authored message. Use for table/PostgREST and
 * Storage errors, whose raw `.message` is never appropriate for the client.
 */
export function queryError(context: string, error: unknown): Error {
  console.error(`[queries] ${context}`, extract(error));
  return new Error(context);
}

/**
 * Like `queryError`, but preserves the raw `.message` in the returned Error —
 * for SECURITY DEFINER RPCs that intentionally `RAISE EXCEPTION` with curated,
 * user-facing business messages ("Only 2 left of …", "Cannot deactivate an
 * admin"). Falls back to `context` when the RPC returned no message.
 */
export function rpcError(context: string, error: unknown): Error {
  const e = extract(error);
  console.error(`[queries] ${context}`, e);
  return new Error(e.message && e.message.trim().length > 0 ? e.message : context);
}
