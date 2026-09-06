"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { publicEnv } from "@/config/env";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import { createEwalletPaymentRequest, createCardPaymentSession } from "@/lib/xendit/client";
import type { ActionResult } from "@/types/action.types";
import {
  createXenditCardSessionSchema,
  createXenditEwalletPaymentSchema,
} from "@/features/payments/schemas/xendit.schema";

/**
 * Buyer starts (or resumes) a GCash/Maya payment for one of their own
 * pending orders. `beginXenditPaymentAttempt` idempotently reserves the
 * attempt (double-click/retry safe at the DB layer); Xendit's own
 * `Idempotency-Key` (the same `payments.id`) is a second layer of
 * protection against duplicate requests on the Xendit side.
 *
 * The buyer is redirected straight to Xendit's hosted checkout — this
 * Server Action never marks anything paid. Only the webhook
 * (`process_xendit_webhook`) does that.
 */
export async function createXenditEwalletPaymentAction(
  orderId: string,
  channelCode: "GCASH" | "PAYMAYA",
): Promise<ActionResult<null>> {
  const parsed = createXenditEwalletPaymentSchema.safeParse({ orderId, channelCode });
  if (!parsed.success) return fromZodError(parsed.error);

  const user = await queries.requireSessionUser();
  const order = await queries.getBuyerOrder(parsed.data.orderId, user.id);
  if (!order) return fail("Order not found.");

  let redirectUrl: string;
  try {
    const attempt = await queries.beginXenditPaymentAttempt(
      parsed.data.orderId,
      parsed.data.channelCode,
    );

    // Already confirmed with Xendit and still valid — resume instead of
    // creating a duplicate payment request.
    if (attempt.xenditPaymentRequestId && attempt.checkoutUrl) {
      redirectUrl = attempt.checkoutUrl;
    } else {
      const returnUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.orderDetail(parsed.data.orderId)}?xendit_return=1`;
      const response = await createEwalletPaymentRequest({
        referenceId: attempt.id,
        channelCode: parsed.data.channelCode,
        amountCents: attempt.amountCents,
        currency: attempt.currency,
        successReturnUrl: returnUrl,
        failureReturnUrl: returnUrl,
      });

      const action = response.actions?.find((a) => a.type === "REDIRECT_CUSTOMER");
      if (!action?.value) {
        await queries.finalizeXenditPaymentRequest({
          paymentId: attempt.id,
          xenditPaymentRequestId: response.payment_request_id,
          checkoutUrl: "",
          expiresAt: null,
          status: "failed",
        });
        return fail("Xendit did not return a checkout link. Please try again.");
      }

      const finalized = await queries.finalizeXenditPaymentRequest({
        paymentId: attempt.id,
        xenditPaymentRequestId: response.payment_request_id,
        checkoutUrl: action.value,
        expiresAt: null,
      });
      redirectUrl = finalized.checkoutUrl ?? action.value;
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not start this payment.");
  }

  redirect(redirectUrl);
}

/**
 * Buyer starts a Card payment session. Returns a short-lived
 * `components_sdk_key` for the client-side Components widget to mount —
 * the secret API key never leaves the server, and raw card data never
 * reaches it either. The webhook, not this action, confirms payment.
 */
export async function createXenditCardSessionAction(
  orderId: string,
): Promise<ActionResult<{ paymentId: string; componentsSdkKey: string }>> {
  const parsed = createXenditCardSessionSchema.safeParse({ orderId });
  if (!parsed.success) return fromZodError(parsed.error);

  const user = await queries.requireSessionUser();
  const order = await queries.getBuyerOrder(parsed.data.orderId, user.id);
  if (!order) return fail("Order not found.");

  try {
    // Card sessions carry a short-lived components_sdk_key that can't be
    // meaningfully reused across requests, so every call mints a fresh
    // Xendit session — but still against the same idempotently-reserved
    // `payments` row, so no duplicate row is ever created for one intent.
    const attempt = await queries.beginXenditPaymentAttempt(parsed.data.orderId, "CARD");

    const returnUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.orderDetail(parsed.data.orderId)}?xendit_return=1`;
    const session = await createCardPaymentSession({
      referenceId: attempt.id,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      successReturnUrl: returnUrl,
      cancelReturnUrl: returnUrl,
    });

    await queries.finalizeXenditPaymentRequest({
      paymentId: attempt.id,
      xenditPaymentRequestId: session.payment_session_id,
      checkoutUrl: returnUrl,
      expiresAt: null,
    });

    return ok({ paymentId: attempt.id, componentsSdkKey: session.components_sdk_key });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not start this payment.");
  }
}
