/** Envelope every Server Action returns, so UI can branch without try/catch. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/** Narrowing helper for consumers of ActionResult. */
export function isActionSuccess<T>(
  result: ActionResult<T>,
): result is { success: true; data: T } {
  return result.success;
}
