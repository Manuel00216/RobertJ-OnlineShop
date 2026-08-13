#!/usr/bin/env node
/**
 * Reports & analytics — isolation smoke test (pure anon-key flow).
 *
 *   node scripts/e2e-reports.mjs
 *
 * Asserts the four `report_*` RPCs are NOT callable without an authenticated
 * session: `anon` has no EXECUTE grant, so PostgREST must reject every call.
 * This is the data-layer half of the unauthenticated-access check (the route
 * half is `proxy.ts` redirecting `/dashboard/reports`).
 *
 * Deeper number-correctness and seller/admin scoping are verified separately
 * against seeded data inside rolled-back transactions (see the phase notes) —
 * that needs privileged impersonation this anon-key script can't do.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const finish = (code) => {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 100);
};

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const FROM = "2026-08-01";
const TO = "2026-08-31";

const RPCS = [
  ["report_sales_summary", { p_from: FROM, p_to: TO, p_shop_id: null }],
  ["report_sales_timeseries", { p_from: FROM, p_to: TO, p_granularity: "day", p_shop_id: null }],
  ["report_order_status_breakdown", { p_from: FROM, p_to: TO, p_shop_id: null }],
  ["report_top_products", { p_from: FROM, p_to: TO, p_limit: 5, p_shop_id: null }],
];

async function main() {
  for (const [fn, args] of RPCS) {
    const { data, error } = await sb.rpc(fn, args);
    const rejected = Boolean(error) && data == null;
    log(
      `anon cannot execute ${fn}()`,
      rejected,
      error ? `raw "${error.message}"` : "UNEXPECTED SUCCESS",
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`);
  finish(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  finish(1);
});
