#!/usr/bin/env node
/**
 * Verifies `handle_new_user()` — the ONE piece of the OAuth account-linking
 * system that is actually our code, as opposed to Supabase Auth's (GoTrue's)
 * own server-side identity linking, which cannot be scripted here (it
 * requires a real browser completing a real Google/Facebook consent screen;
 * see the manual QA checklist in the OAuth implementation plan instead).
 *
 *   node scripts/e2e-oauth-profile-trigger.mjs
 *
 * Uses the Supabase Admin API (service role key) to create `auth.users` rows
 * shaped like what GoTrue produces for a genuinely-new OAuth signup — same
 * technique as `credentials/seed-accounts.md`'s seed accounts, but via the
 * supported Admin API now that a service-role key is available locally,
 * rather than raw SQL. This exercises the trigger in isolation; it does NOT
 * exercise GoTrue's own decision about whether to link to an existing user
 * or create a new one (that decision happens before any row this script can
 * observe is even inserted).
 *
 * Every user created here is deleted in a `finally` block — this hits a real
 * project, not a throwaway one.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is required in .env.local to run this script " +
      "(Admin API access to create/delete test users).",
  );
  process.exit(2);
}

const finish = (code) => {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 100);
};

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

const createdUserIds = [];
async function createTestUser(user_metadata) {
  const email = `oauth-trigger-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  createdUserIds.push(data.user.id);
  return data.user.id;
}

// AFTER INSERT triggers run in the same transaction as the insert, but the
// Admin API call returns over the network — a short retry absorbs any
// read-replica/propagation lag rather than racing the assertion.
async function fetchProfile(userId, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await admin
      .from("profiles")
      .select("full_name, avatar_url, role, username")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`profiles select failed: ${error.message}`);
    if (data) return data;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function main() {
  try {
    // #1 — New Google user: full_name/avatar_url keys, as Google supplies.
    {
      const id = await createTestUser({
        full_name: "Test Google User",
        avatar_url: "https://example.com/google-avatar.png",
      });
      const profile = await fetchProfile(id);
      log("Google-shaped signup creates a profile", Boolean(profile));
      log(
        "Google-shaped signup populates full_name/avatar_url",
        profile?.full_name === "Test Google User" &&
          profile?.avatar_url === "https://example.com/google-avatar.png",
      );
      log("New signup defaults to role=buyer", profile?.role === "buyer");
    }

    // #7 — Facebook-shaped signup: `name`/`picture` keys, no `full_name`/`avatar_url`.
    // Proves the coalescing migration (20260819000200) actually works.
    {
      const id = await createTestUser({
        name: "Test Facebook User",
        picture: "https://example.com/facebook-avatar.png",
      });
      const profile = await fetchProfile(id);
      log(
        "Facebook-shaped signup (name/picture) still populates full_name/avatar_url",
        profile?.full_name === "Test Facebook User" &&
          profile?.avatar_url === "https://example.com/facebook-avatar.png",
      );
    }

    // #7 (cont.) — Facebook with no email/profile metadata at all (denied
    // permission or no confirmed email on their end): must not throw, must
    // still create a valid — if blank — profile.
    {
      const id = await createTestUser({});
      const profile = await fetchProfile(id);
      log("No-metadata signup still creates a profile (does not throw)", Boolean(profile));
      log(
        "No-metadata signup leaves full_name/avatar_url null rather than a garbage value",
        profile?.full_name === null && profile?.avatar_url === null,
      );
      log("No-metadata signup still defaults to role=buyer", profile?.role === "buyer");
    }

    // #6 — Different emails/ids never collapse into one profile.
    {
      const idA = await createTestUser({ full_name: "User A" });
      const idB = await createTestUser({ full_name: "User B" });
      const [profileA, profileB] = await Promise.all([fetchProfile(idA), fetchProfile(idB)]);
      log(
        "Two different signups get two distinct profiles",
        profileA?.full_name === "User A" && profileB?.full_name === "User B" && idA !== idB,
      );
    }

    // #8 — Static check: the trigger must never branch on `new.email` to
    // decide whether to reuse an existing profile. Account matching is
    // Supabase Auth's job (verified-email identity linking), done before
    // this trigger ever runs; this trigger must only ever act on `new.id`.
    // Re-implementing an email match here would bypass GoTrue's
    // pre-account-takeover safeguard — this assertion guards against that
    // regression being reintroduced later.
    {
      const migrationSql = readFileSync(
        "supabase/migrations/20260819000200_oauth_profile_metadata_coalesce.sql",
        "utf8",
      );
      const hasEmailBasedMatching = /select[\s\S]*?from\s+public\.profiles[\s\S]*?email/i.test(
        migrationSql,
      ) || /from\s+auth\.users/i.test(migrationSql);
      log(
        "handle_new_user() does not implement custom email-based account matching",
        !hasEmailBasedMatching,
      );
    }
  } finally {
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  }

  finish(summary());
}

main().catch((error) => {
  console.error(error);
  finish(1);
});
