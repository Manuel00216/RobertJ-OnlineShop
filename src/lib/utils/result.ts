import { z } from "zod";

import type { ActionResult } from "@/types/action.types";

/** Wraps a successful payload in the shared action envelope. */
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/** Wraps a failure in the shared action envelope. */
export function fail<T = never>(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { success: false, error: message, fieldErrors };
}

/** Normalises a Zod failure into the shared action envelope. */
export function fromZodError<T = never>(error: z.ZodError): ActionResult<T> {
  const flattened = z.flattenError(error);
  return fail<T>("Please correct the highlighted fields.", flattened.fieldErrors as Record<string, string[]>);
}
