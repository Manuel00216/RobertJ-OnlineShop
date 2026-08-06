#!/usr/bin/env node
/**
 * Stripe test-mode E2E (Module 6): creates a Payment Intent exactly as the app's
 * `createPaymentIntentForOrder` does (amount/currency/automatic methods), then
 * confirms it with Stripe's test card (`tok_visa`) and asserts the payment
 * succeeds with the correct amount/currency.
 *
 *   node scripts/e2e-stripe.mjs <amountCents> <currency>
 *
 * The order being paid is seeded/cleaned up around this via the Supabase MCP SQL
 * tool; this script exercises the Stripe test payment backend itself. A created
 * intent is test-mode data (never charged); a succeeded intent is terminal and
 * left in Stripe's test environment.
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";

const [amountCents, currency] = process.argv.slice(2);
if (!amountCents || !currency) {
  console.error("usage: node scripts/e2e-stripe.mjs <amountCents> <currency>");
  process.exit(2);
}

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// Windows/Node libuv workaround (same as e2e-flow.mjs).
const finish = (code) => {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 100);
};

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const summary = () => {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`);
  if (failed.length) for (const f of failed) console.log("  FAILED: " + f.name);
  return failed.length ? 1 : 0;
};

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const amount = Number(amountCents);

async function main() {
  // 1) Create the intent with the same params createPaymentIntentForOrder uses.
  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata: { orderId: "e2e-temp", buyerId: "e2e-temp" },
    automatic_payment_methods: { enabled: true },
  });
  log("PaymentIntent created (client_secret present)", Boolean(intent.id && intent.client_secret), `id ${intent.id}`);
  log("intent amount matches order", intent.amount === amount, `expected ${amount}, got ${intent.amount}`);
  log(
    "intent currency matches order",
    intent.currency === currency.toLowerCase(),
    `expected ${currency.toLowerCase()}, got ${intent.currency}`,
  );

  // 2) Confirm with Stripe's test card — the same backend the Payment Element
  // drives (the app supplies a return_url via confirmParams; the API confirm
  // needs the same for redirect-capable payment methods).
  const confirmed = await stripe.paymentIntents.confirm(intent.id, {
    payment_method_data: { type: "card", card: { token: "tok_visa" } },
    return_url: `${env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/orders`,
  });
  log("confirm with test card → succeeded", confirmed.status === "succeeded", `status ${confirmed.status}`);

  // 3) Retrieve to confirm the terminal state is idempotent.
  const retrieved = await stripe.paymentIntents.retrieve(intent.id);
  log("retrieve reflects succeeded", retrieved.status === "succeeded", `status ${retrieved.status}`);

  finish(summary());
}

main().catch((error) => {
  console.error("E2E error:", error.message);
  finish(1);
});
