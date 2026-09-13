"use server";

import { getClientIp } from "@/lib/utils/request";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { guidedSelectionQuerySchema } from "@/features/assistant/schemas/quiz.schema";
import type { GuidedSelectionMatch } from "@/features/assistant/types/assistant.types";

/**
 * Buyer-facing Guided Selection match query (DECISIONS.md ADR-009 —
 * rule-based, never AI/ML). Public, no `requireSessionUser()` — a guest can
 * use Guided Selection with no account, same as the rest of the
 * catalog/cart reads (ADR-013's precedent).
 */
export async function getGuidedSelectionMatchesAction(
  input: unknown,
): Promise<ActionResult<GuidedSelectionMatch[]>> {
  const parsed = guidedSelectionQuerySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`guidedSelection:${ip}`, 20, 60);
    const matches = await queries.listGuidedSelectionMatches(parsed.data);
    return ok(matches);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load matches.");
  }
}
