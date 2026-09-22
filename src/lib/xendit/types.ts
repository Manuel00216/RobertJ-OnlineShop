/**
 * Xendit channel codes this app supports. "CARD" is handled through a
 * Payment Session (mode=COMPONENTS), not a plain payment request — see
 * createCardPaymentSession.
 */
export type XenditEwalletChannelCode = "GCASH" | "PAYMAYA";

export interface XenditPaymentRequestAction {
  type: string;
  descriptor: string;
  value: string;
}

export interface XenditPaymentRequestResponse {
  payment_request_id: string;
  reference_id: string;
  status: string;
  actions?: XenditPaymentRequestAction[];
  channel_code?: string;
  request_amount?: number;
  currency?: string;
  created?: string;
  /** Only present once a payment actually succeeds against this request. Not documented for GCASH/PAYMAYA responses generally — read defensively. */
  payment_id?: string;
  [key: string]: unknown;
}

export interface XenditPaymentSessionResponse {
  payment_session_id: string;
  components_sdk_key: string;
  reference_id: string;
  status: string;
  currency?: string;
  amount?: number;
  created?: string;
  /** ISO 8601. Xendit documents Sessions as expiring 30 minutes after creation by default. */
  expires_at?: string;
  /** Present once the session resolves to a completed payment. */
  payment_id?: string;
  payment_request_id?: string;
  [key: string]: unknown;
}

/**
 * Raw shape of a Xendit `payment.*` (Payment Request family — GCash/Maya) or
 * `payment_session.*` (Payment Session family — Card) webhook body — only
 * the fields we read.
 *
 * `data` matches the documented nested shape for both families
 * (https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session.md
 * confirms `payment_session.completed`/`.expired` nest under `data` the same
 * way the already-working Payment Request family does). The amount field
 * name differs between families though: Payment Request uses
 * `request_amount`, Payment Session uses `amount` — confirmed against both
 * that doc and a live `GET /sessions/{id}` response for a real completed
 * session (`{"amount":5697,...}`, no `request_amount` field at all).
 *
 * The top-level fields below are a fallback only, read when `data` itself is
 * absent — Payment Session's own REST representation (that same live GET
 * call) is a *flat* object with no `data` wrapper, and this app has no
 * confirmed live sample of the Card *webhook* payload specifically (a
 * `payment_session.completed`/`.expired` event was received in production —
 * confirmed via Vercel request logs — but its body was never captured, so
 * this fallback exists for defense against an undocumented flat variant
 * rather than a proven one).
 */
export interface XenditPaymentWebhookPayload {
  event: string;
  data?: {
    payment_id?: string;
    payment_request_id?: string;
    reference_id?: string;
    status?: string;
    request_amount?: number;
    amount?: number;
    currency?: string;
    channel_code?: string;
    failure_code?: string;
    [key: string]: unknown;
  };
  reference_id?: string;
  status?: string;
  payment_id?: string;
  payment_request_id?: string;
  request_amount?: number;
  amount?: number;
  currency?: string;
  channel_code?: string;
  [key: string]: unknown;
}

/**
 * Response from `POST /refunds`. Verified live against Test Mode (Phase
 * 5B-1 spike): `status` here is never trusted as final even when it reads
 * "SUCCEEDED" synchronously — Xendit's own docs say to wait for the
 * `refund.succeeded`/`refund.failed` webhook, so `createRefund`'s caller
 * only ever uses this response to record `id`/raw body, never to decide a
 * final outcome.
 */
export interface XenditRefundResponse {
  id: string;
  payment_request_id: string;
  payment_id?: string;
  amount: number;
  currency: string;
  status: string;
  failure_code?: string | null;
  [key: string]: unknown;
}

/** Raw shape of a Xendit `refund.*` webhook body — only the fields we read. */
export interface XenditRefundWebhookPayload {
  event: string;
  data: {
    id?: string;
    payment_request_id?: string;
    payment_id?: string;
    reference_id?: string | null;
    channel_code?: string;
    amount?: number;
    currency?: string;
    status?: string;
    failure_code?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
