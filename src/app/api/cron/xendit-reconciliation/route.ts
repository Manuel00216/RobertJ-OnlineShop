import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/config/env";
import * as queries from "@/lib/supabase/queries";
import {
  isStaleXenditAttempt,
  reconcileStaleXenditAttempt,
} from "@/features/payments/lib/xendit-reconciliation";

/**
 * Phase #4A: passive reconciliation sweep for Xendit payments left "pending"
 * with nobody left to trigger fix #5A/#5B's synchronous reconciliation — the
 * buyer never returns to retry or cancel, so the attempt would otherwise sit
 * stale forever. Triggered by Vercel Cron (see `vercel.json`); reuses the
 * exact fix #5A/#5B building blocks (`isStaleXenditAttempt`,
 * `reconcileStaleXenditAttempt`) so no payment-status logic is duplicated.
 *
 * This route NEVER creates or charges anything — it only asks Xendit for the
 * real status of an already-finalized attempt and applies it through the
 * same `process_xendit_webhook` RPC the real webhook and fix #5A/#5B use.
 * COD is out of scope by construction: `getStaleXenditPaymentsForReconciliationSweep`
 * only reads `payment_method_type = 'xendit'` rows.
 */

/** Oldest-first raw rows to consider per run — bounds the query, not the work actually done (see queries.ts docs). */
const FETCH_LIMIT = 200;
/** Hard cap on how many stale candidates are actually reconciled (i.e. call Xendit) per run, regardless of how many were fetched. */
const BATCH_LIMIT = 20;

interface SweepSummary {
  candidatesFetched: number;
  reconciled: number;
  alreadyPaid: number;
  clearedForRetry: number;
  blocked: number;
  skippedNotStale: number;
  errors: number;
}

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const expected = env.CRON_SECRET;
  const provided = request.headers.get("authorization");

  if (!expected || !isAuthorized(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let candidates: Awaited<ReturnType<typeof queries.getStaleXenditPaymentsForReconciliationSweep>>;
  try {
    candidates = await queries.getStaleXenditPaymentsForReconciliationSweep(FETCH_LIMIT);
  } catch (error) {
    console.error("[xendit reconciliation sweep] failed to load candidates", error);
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const summary: SweepSummary = {
    candidatesFetched: candidates.length,
    reconciled: 0,
    alreadyPaid: 0,
    clearedForRetry: 0,
    blocked: 0,
    skippedNotStale: 0,
    errors: 0,
  };

  for (const candidate of candidates) {
    if (summary.reconciled >= BATCH_LIMIT) break;

    if (!isStaleXenditAttempt(candidate.attempt)) {
      summary.skippedNotStale++;
      continue;
    }

    summary.reconciled++;
    try {
      const outcome = await reconcileStaleXenditAttempt(
        candidate.referenceId,
        candidate.channelCode,
        candidate.attempt,
      );
      if (outcome === "already_paid") summary.alreadyPaid++;
      else if (outcome === "cleared_for_retry") summary.clearedForRetry++;
      else summary.blocked++;
    } catch (error) {
      // reconcileStaleXenditAttempt already catches its own Xendit/RPC
      // failures and returns "blocked" rather than throwing. This guard is
      // defense-in-depth only: one candidate erroring unexpectedly must
      // never abort the sweep for the rest of the batch.
      summary.errors++;
      console.error("[xendit reconciliation sweep] candidate failed", {
        referenceId: candidate.referenceId,
        channelCode: candidate.channelCode,
        error,
      });
    }
  }

  return NextResponse.json({ received: true, ...summary });
}

function isAuthorized(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const expectedHeader = `Bearer ${expected}`;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expectedHeader);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
