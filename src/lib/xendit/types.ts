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
  [key: string]: unknown;
}

/** Raw shape of a Xendit `payment.*` webhook body — only the fields we read. */
export interface XenditPaymentWebhookPayload {
  event: string;
  data: {
    payment_id?: string;
    payment_request_id?: string;
    reference_id?: string;
    status?: string;
    request_amount?: number;
    currency?: string;
    channel_code?: string;
    failure_code?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
