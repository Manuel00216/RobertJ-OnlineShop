#!/usr/bin/env node
/**
 * Runs the auth lifecycle assertions against a user that ALREADY exists in the
 * project (created via the MCP SQL tool). Pure normal-flow (anon key).
 *
 *   node scripts/e2e-flow.mjs <email> <password> <newPassword>
 *
 * Two phases, selected by the user's current confirmation state:
 *  - UNCONFIRMED: asserts sign-in is rejected with the friendly "Email not
 *    confirmed" copy (exit 0 → then confirm via SQL and re-run).
 *  - CONFIRMED:   asserts sign-in, session persistence (same + transferable),
 *    forgot-password request, reset (updateUser), logout, re-login.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password, newPassword] = process.argv.slice(2);
if (!email || !password || !newPassword) {
  console.error("usage: node scripts/e2e-flow.mjs <email> <password> <newPassword>");
  process.exit(2);
}

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// Windows/Node libuv workaround: exit via a deferred macrotask so fetch
// keepalive handles drain cleanly (avoids the UV_HANDLE_CLOSING assertion).
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
const summary = (phase) => {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} passed (phase: ${phase}) =====`);
  if (failed.length) for (const f of failed) console.log("  FAILED: " + f.name);
  return failed.length ? 1 : 0;
};

const KNOWN = [
  [/invalid login credentials/i, "Invalid email or password."],
  [/email not confirmed|unverified/i, "Please verify your email address. We sent a link to your inbox."],
  [/already registered|user already exists/i, "An account with this email already exists. Try signing in."],
  [/rate limit|too many requests|429/i, "Too many attempts. Please try again later."],
];
const friendly = (e) => {
  const m = e instanceof Error ? e.message : String(e ?? "");
  for (const [p, c] of KNOWN) if (p.test(m)) return c;
  return "Something went wrong. Please try again.";
};

async function main() {
  const { data: first, error: firstErr } = await sb.auth.signInWithPassword({ email, password });

  // --- UNCONFIRMED phase ------------------------------------------------
  if (firstErr && /not confirmed|unverified/i.test(firstErr.message)) {
    log("signIn while UNCONFIRMED is rejected", true, `raw "${firstErr.message}"`);
    log(
      "unconfirmed sign-in → friendly copy",
      friendly(firstErr) === "Please verify your email address. We sent a link to your inbox.",
      `→ "${friendly(firstErr)}"`,
    );
    const { error: w } = await sb.auth.signInWithPassword({ email, password: "WrongPass999!" });
    const fw = friendly(w);
    log(
      "wrong password → friendly copy (unconfirmed)",
      w && fw === "Invalid email or password.",
      w ? `raw "${w.message}" → "${fw}"` : "unexpected success",
    );
    finish(summary("UNCONFIRMED"));
    return;
  }

  // --- CONFIRMED phase --------------------------------------------------
  const session = first.session;
  log("signIn (correct credentials)", Boolean(session), "");

  if (session) {
    {
      const { data: me, error } = await sb.auth.getUser();
      log("session persistence (getUser with session)", !error && me.user?.email === email, error?.message ?? "");
      const sb2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await sb2.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      const { data: me2, error: e2 } = await sb2.auth.getUser();
      log("session transferable to a new client", !e2 && me2.user?.email === email, e2?.message ?? "");
    }

    {
      const { error: w } = await sb.auth.signInWithPassword({ email, password: "WrongPass999!" });
      const fw = friendly(w);
      log(
        "wrong password → friendly copy",
        w && fw === "Invalid email or password.",
        w ? `raw "${w.message}" → "${fw}"` : "unexpected success",
      );
    }

    {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback?next=/reset-password`,
      });
      // The app's requestPasswordResetAction ALWAYS returns success (no
      // enumeration). Supabase either sends the email or rate-limits it —
      // either is "working"; a rate limit must map to the friendly copy.
      const rateLimited = error && /rate limit|too many/i.test(error.message);
      log(
        "forgot-password request (email sent or rate-limited)",
        !error || rateLimited,
        error ? (rateLimited ? "rate-limited (flow works)" : error.message) : "email send initiated",
      );
      if (rateLimited) {
        log(
          "forgot-password rate-limit → friendly copy",
          friendly(error) === "Too many attempts. Please try again later.",
          `→ "${friendly(error)}"`,
        );
      }
    }

    {
      const { error: upErr } = await sb.auth.updateUser({ password: newPassword });
      log("reset password (updateUser — recovery-path API)", !upErr, upErr?.message ?? "");
      const { error: outErr } = await sb.auth.signOut();
      log("logout (signOut)", !outErr, outErr?.message ?? "");
      const { data: after, error: afterErr } = await sb.auth.getSession();
      log("session cleared after logout", !afterErr && !after.session, afterErr?.message ?? "");
      const { data: relog, error: relogErr } = await sb.auth.signInWithPassword({ email, password: newPassword });
      log("signIn with NEW password after reset", !relogErr && Boolean(relog.session), relogErr?.message ?? "");
    }
  } else {
    log("signIn (correct credentials)", false, firstErr?.message ?? "no session");
  }

  finish(summary("CONFIRMED"));
}

main();
