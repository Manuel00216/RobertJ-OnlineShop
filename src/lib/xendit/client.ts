import "server-only";

import { getServerEnv } from "@/config/env";

import type {
  XenditEwalletChannelCode,
  XenditPaymentRequestResponse,
  XenditPaymentSessionResponse,
} from "./types";

const XENDIT_API_BASE_URL = "https://api.xendit.co";
const XENDIT_API_VERSION = "2024-11-11";

/**
 * Amount unit conversion, isolated deliberately: Xendit's docs were
 * inconsistent on whether `request_amount`/`amount` for PHP are decimal
 * major units (pesos) or minor units (centavos) — see DECISIONS.md. Treated
 * here as decimal pesos (cents / 100), matching the older Invoice product's
 * documented convention. Confirm against one real sandbox response before
 * relying on this for the webhook's amount-mismatch check in production.
 */
export function centsToXenditAmount(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

export function xenditAmountToCents(amount: number): number {
  return Math.round(amount * 100);
}

function getSecretKey(): string {
  const env = getServerEnv();
  if (!env.XENDIT_SECRET_KEY) {
    throw new Error("XENDIT_SECRET_KEY is required for Xendit payment operations.");
  }
  return env.XENDIT_SECRET_KEY;
}

async function xenditFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const secretKey = getSecretKey();
  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Basic ${basicAuth}`,
    "api-version": XENDIT_API_VERSION,
  };
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }

  const response = await fetch(`${XENDIT_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Xendit request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

export interface XenditCustomerInput {
  /** Buyer's own id, sent as Xendit's `customer.reference_id`. */
  id: string;
  /** Buyer's display name, sent as `customer.individual_detail.given_names`. */
  givenNames: string;
}

export interface CreateEwalletPaymentRequestInput {
  referenceId: string;
  channelCode: XenditEwalletChannelCode;
  amountCents: number;
  currency: string;
  successReturnUrl: string;
  failureReturnUrl: string;
  customer: XenditCustomerInput;
}

/**
 * GCash / Maya — POST /v3/payment_requests, redirect-based e-wallet flow.
 * PAYMAYA's validator additionally requires `channel_properties.cancel_return_url`
 * and a `customer` object (confirmed against live test-mode API responses);
 * GCASH was confirmed working without either, so both stay GCash-only-absent
 * rather than being added unconditionally.
 */
export async function createEwalletPaymentRequest(
  input: CreateEwalletPaymentRequestInput,
): Promise<XenditPaymentRequestResponse> {
  const isPayMaya = input.channelCode === "PAYMAYA";
  return xenditFetch<XenditPaymentRequestResponse>("/v3/payment_requests", {
    method: "POST",
    idempotencyKey: input.referenceId,
    body: JSON.stringify({
      reference_id: input.referenceId,
      type: "PAY",
      country: "PH",
      currency: input.currency,
      request_amount: centsToXenditAmount(input.amountCents),
      capture_method: "AUTOMATIC",
      channel_code: input.channelCode,
      channel_properties: {
        success_return_url: input.successReturnUrl,
        failure_return_url: input.failureReturnUrl,
        ...(isPayMaya ? { cancel_return_url: input.failureReturnUrl } : {}),
      },
      ...(isPayMaya
        ? {
            customer: {
              type: "INDIVIDUAL",
              reference_id: input.customer.id,
              individual_detail: { given_names: input.customer.givenNames },
            },
          }
        : {}),
    }),
  });
}

export interface CreateCardPaymentSessionInput {
  referenceId: string;
  amountCents: number;
  currency: string;
  successReturnUrl: string;
  cancelReturnUrl: string;
  customer: XenditCustomerInput;
}

/**
 * Card — POST /sessions with mode=COMPONENTS. Returns a short-lived
 * components_sdk_key for the client-side `xendit-components-web` widget to
 * collect and tokenize the card entirely in the browser; raw card data never
 * reaches this server. The exact webhook event family fired on completion
 * (payment_session.* vs payment.*) is unconfirmed against a live sandbox —
 * the webhook route handles both shapes defensively.
 *
 * `channel_properties`, a populated `customer`, and
 * `components_configuration.origins` are all confirmed-required by live
 * test-mode API responses — the session create call 400s without them.
 */
export async function createCardPaymentSession(
  input: CreateCardPaymentSessionInput,
): Promise<XenditPaymentSessionResponse> {
  return xenditFetch<XenditPaymentSessionResponse>("/sessions", {
    method: "POST",
    idempotencyKey: input.referenceId,
    body: JSON.stringify({
      reference_id: input.referenceId,
      session_type: "PAY",
      mode: "COMPONENTS",
      country: "PH",
      currency: input.currency,
      amount: centsToXenditAmount(input.amountCents),
      capture_method: "AUTOMATIC",
      success_return_url: input.successReturnUrl,
      cancel_return_url: input.cancelReturnUrl,
      channel_properties: {
        success_return_url: input.successReturnUrl,
        cancel_return_url: input.cancelReturnUrl,
      },
      customer: {
        type: "INDIVIDUAL",
        reference_id: input.customer.id,
        individual_detail: { given_names: input.customer.givenNames },
      },
      components_configuration: {
        origins: [new URL(input.successReturnUrl).origin],
        payment_method: {
          card: {},
        },
      },
    }),
  });
}
