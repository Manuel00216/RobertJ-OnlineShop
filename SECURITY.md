# SECURITY.md — Security Policy

> [!IMPORTANT]
> **Read this first.** This document covers how to report a security issue and summarizes the security model of RoberJ Online Shop. For the full technical detail, see [ARCHITECTURE.md → RBAC Model](./ARCHITECTURE.md#rbac-model). For the standards contributors must follow, see [CLAUDE.md → Security Standards](./CLAUDE.md#security-standards).

## Reporting a vulnerability

This is a capstone academic project (RoberJ Online Shop), not a public production service with a bug-bounty program. If you find a security issue:

1. **Do not** open a public GitHub issue describing the vulnerability.
2. Report it privately to the project maintainer(s) with:
   - The affected module (see [MODULES.md](./MODULES.md) for the module map).
   - Steps to reproduce, and the role/account context (Guest, Customer, Shop Owner, Administrator) it requires.
   - The actual vs. expected behavior, and the impact (data exposure, privilege escalation, etc.).
3. Allow time for the issue to be investigated and fixed before any public disclosure.

There is currently no dedicated security contact email configured in this repository; report through the project's primary maintainer/repository owner channel.

## Supported versions

This project has not reached a versioned `1.0` release (see [CHANGELOG.md](./CHANGELOG.md)). Security fixes apply to the `main` branch only — there are no maintained release branches to backport to.

## Security model summary

RoberJ enforces authorization **in depth**, with the database itself as the primary boundary — not just application code:

| Layer | Mechanism | Detail |
|---|---|---|
| Route guards | `src/proxy.ts` | Redirects unauthenticated users away from `PROTECTED_ROUTE_PREFIXES` on every request. |
| Layout checks | e.g. `src/app/(account)/layout.tsx` | Server-side `requireSessionUser()` as a second check. |
| Service-layer guards | `src/lib/supabase/queries.ts` | `requireSessionUser()` / `requireRole(allowed)` before any protected read/write. |
| DEFINER helpers | SQL functions | `current_user_role()`, `is_admin()` — `SECURITY DEFINER`, used inside RLS policies to avoid recursive lookups on `profiles`. |
| **Row-Level Security (primary)** | Postgres RLS policies | Per-operation, per-role policies on every table — the boundary that holds even if an application check is missed. |

Full detail and diagrams: [ARCHITECTURE.md → RBAC Model](./ARCHITECTURE.md#rbac-model). Why RLS is primary, not just a backstop: [DECISIONS.md → ADR-007](./DECISIONS.md#adr-007-row-level-security-as-the-primary-authorization-boundary).

### Key protections in place

- **No account enumeration** — password-reset always reports success regardless of whether the email exists.
- **No open redirects** — the PKCE auth callback validates that `next` is a same-origin path before redirecting.
- **No role self-escalation** — a `prevent_role_self_escalation` trigger blocks a user from changing their own `role`, even though `WITH CHECK` alone can't see the prior value.
- **No client-trusted financial fields** — `buyer_id`, `payment_status`, and price/title snapshots on order lines are never accepted from the client; `buyer_id` is always derived from `auth.uid()` inside the `create_order` RPC.
- **Least-privilege grants** — sensitive columns (e.g. `profiles.phone`) are withheld from default `SELECT` grants and exposed only through the `get_my_profile()` `SECURITY DEFINER` RPC.
- **No DELETE on financial history** — `orders`, `order_items`, and `payments` have no `DELETE` policy; history is immutable.
- **Idempotent, reviewed migrations** — every schema change ships its RLS policies in the same transactional migration (see [ARCHITECTURE.md → Migration Notes](./ARCHITECTURE.md#migration-notes)); prior audits (`security_hardening`, `rls_hardening`, `restore_profiles_column_grants`) closed real findings (F1–F5, H1) — see the migration history for specifics.

## Secrets handling

- All environment variables are read **only** through `src/config/env.ts`, which validates them at startup with Zod and fails fast (see [CLAUDE.md → Repository Conventions](./CLAUDE.md#repository-conventions)).
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely — it is server-only, used exclusively for trusted server-side jobs, and must never be imported into client code or logged.
- `.env.local` is gitignored; only `.env.example` (with empty placeholder values) is committed.

## Dependency policy

- New dependencies require clear value and are subject to [CLAUDE.md → AI Non-Negotiable Rules](./CLAUDE.md#ai-non-negotiable-rules) ("no new libraries without clear value and approval").
- There is no automated dependency-vulnerability scanning configured yet. Until one exists, run `npm audit` before merging dependency bumps and treat any high/critical finding as blocking.

## Known limitations (tracked, not hidden)

See [ARCHITECTURE.md → Technical Debt Register](./ARCHITECTURE.md#technical-debt-register) for the full, current list. Of particular security relevance:

- ~~**TD-3**~~ — resolved: the Stripe-specific `payments` columns were dropped when QR receipt upload + manual verification (ADR-008) was implemented.
- **TD-6** — no automated regression test suite; security-relevant regressions rely on manual verification and RLS as a backstop, not CI-enforced tests.

---

### Related documents

- 📐 **[ARCHITECTURE.md](./ARCHITECTURE.md)** — full RBAC model and diagrams.
- 📜 **[DECISIONS.md](./DECISIONS.md)** — why the security model is shaped this way.
- 🤖 **[CLAUDE.md](./CLAUDE.md)** — security standards for contributors.
- 🛠️ **[CONTRIBUTING.md](./CONTRIBUTING.md)** — issue reporting workflow.
