#!/usr/bin/env node
/**
 * One-off cleanup: permanently deletes the 3 test seller accounts
 * (seller1/seller2/seller3@roberj-onlineshop.test) from auth.users via the
 * Supabase Admin API — same technique as scripts/e2e-oauth-profile-trigger.mjs.
 *
 * Prerequisite (already done for these 3, verified live): the account must
 * already be deactivated (profiles.is_active = false) and its identity
 * snapshot already archived into admin_action_log (the "former seller"
 * record) — see supabase/migrations/20260928054321_seller_hard_delete_support.sql.
 * `profiles.id references auth.users(id) on delete cascade`, so deleting the
 * auth.users row removes the profile automatically; orders/order_items/
 * payments/return_requests/products survive with seller_id set to null
 * (this migration's FK change) instead of being deleted or reassigned.
 *
 *   node scripts/hard-delete-seller-accounts.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.",
  );
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGETS = [
  { email: "seller1@roberj-onlineshop.test", id: "22e55629-f800-4c93-807b-7e492f9acf6d" },
  { email: "seller2@roberj-onlineshop.test", id: "323fe195-376d-4822-9386-bccd3cd73b9a" },
  { email: "seller3@roberj-onlineshop.test", id: "29baea51-3454-4feb-9446-e1173ddccaf3" },
];

async function main() {
  let failed = 0;
  for (const { email, id } of TARGETS) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.log(`FAIL  ${email} (${id}) — ${error.message}`);
      failed++;
    } else {
      console.log(`OK    ${email} (${id}) deleted`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main();
