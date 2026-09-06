import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { xenditAmountToCents } from "@/lib/xendit/client";
import type { XenditPaymentWebhookPayload } from "@/lib/xendit/types";

/**
 * Xendit webhook receiver — the ONLY thing in this app allowed to mark a
 * payment/order `paid`. Never trust the frontend redirect for that; this
 * route is the sole authority, and even it defers the actual decision to
 * `process_xendit_webhook` (SECURITY DEFINER, service_role-only), which
 * re-validates the reference, amount, and currency against our own
 * database and is idempotent against retries/out-of-order delivery.
 *
 * Handles both the Payment Request webhook family (`payment.capture` /
 * `payment.authorization` / `payment.failure`, used by GCash/Maya) and,
 * defensively, a `payment_session.*` shape for Card — the exact event name
 * Xendit fires on Card session completion was not confirmed against a live
 * sandbox response during implementation (see DECISIONS.md).
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const expectedToken = env.XENDIT_WEBHOOK_TOKEN;
  const providedToken = request.headers.get("x-callback-token");

  if (!expectedToken || !isValidToken(providedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: XenditPaymentWebhookPayload;
  try {
    payload = (await request.json()) as XenditPaymentWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const data = payload?.data;
  const referenceId = data?.reference_id;
  const status = data?.status;

  if (!referenceId || !status) {
    // Not a shape we recognize (e.g. a webhook type we don't subscribe to
    // handling yet). Acknowledge so Xendit doesn't retry indefinitely, but
    // don't touch the database at all.
    return NextResponse.json({ received: true, note: "unrecognized payload shape" });
  }

  const amountCents =
    typeof data.request_amount === "number" ? xenditAmountToCents(data.request_amount) : 0;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("process_xendit_webhook", {
    p_reference_id: referenceId,
    p_xendit_payment_request_id: data.payment_request_id ?? "",
    p_xendit_payment_id: data.payment_id ?? "",
    p_status: status,
    p_channel_code: data.channel_code ?? undefined,
    p_amount_cents: amountCents,
    p_currency: data.currency ?? "PHP",
    p_raw_payload: payload as unknown as Json,
  });

  if (error) {
    console.error("[xendit webhook] process_xendit_webhook failed", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function isValidToken(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
