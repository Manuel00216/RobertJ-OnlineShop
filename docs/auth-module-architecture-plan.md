# Authentication Module — Architecture & UI/UX Blueprint

> Status: **Planning only.** No implementation code in this document. This is
> the foundation for the next phase, mirroring the process used for
> `docs/landing-page-implementation-plan.md`.

## 0. Grounding — what this plan draws on

Every recommendation below is tied to a named source or to this codebase's own
prior decisions, not general intuition:

| Area | Grounded in |
| --- | --- |
| Modal vs. dedicated pages | Baymard Institute checkout/auth UX research; actual Shopee/Lazada/Zalora/Amazon behavior (see §2) |
| Form UX | Nielsen Norman Group form-design heuristics |
| Security | OWASP ASVS v5 (Authentication + Session Management); Supabase's official Auth security guidance |
| Accessibility | WCAG 2.2 AA; WAI-ARIA Authoring Practices (form validation, focus management) |
| Architecture | This project's own `docs/architecture.md` feature-first convention and the `lib/supabase/queries.ts` centralized data layer already built |

---

## 1. Existing project review (Task 1)

### 1.1 What's already built (do not rebuild)

Landing-page phase left real auth infrastructure in place — this plan extends
it, it does not start from zero:

| Layer | File | State |
| --- | --- | --- |
| Query functions | `lib/supabase/queries.ts` | `getSessionUser`, `requireSessionUser`, `requireRole`, `signInWithPassword`, `signUpWithPassword`, `signOut`, `sendPasswordResetEmail`, `updatePassword`, `resendVerificationEmail` — **all implemented** |
| Table names | `constants/database.ts` | `DATABASE_TABLES.PROFILES` etc. — centralized |
| Schemas | `features/auth/schemas/auth.schema.ts` | `signInSchema`, `signUpSchema`, `forgotPasswordSchema`, `resetPasswordSchema` — **all implemented** |
| Actions | `features/auth/actions/auth.actions.ts` | `signInAction`, `signUpAction`, `signOutAction`, `requestPasswordResetAction`, `updatePasswordAction` — **all implemented**, return `ActionResult<T>` |
| PKCE callback | `app/auth/callback/route.ts` | Exchanges `?code=`, redirects to `next` or `/sign-in?error=...` — **implemented, tested** |
| Route protection | `proxy.ts` + `constants/routes.ts` | `PROTECTED_ROUTE_PREFIXES`, `AUTH_ROUTES`, redirect-with-`redirectTo` — **implemented** |
| Route constants | `constants/routes.ts` | `signIn`, `signUp`, `forgotPassword`, `resetPassword`, `authCallback` — **all defined** |
| Sample form | `features/auth/components/SignInForm.tsx` | Uses `useActionState` + `FormField`, reads `redirectTo` from query — **implemented, unstyled (no design-system pass yet)** |
| Roles | `constants/roles.ts` | `USER_ROLES = {buyer, seller, admin}`, `DASHBOARD_ROLES = [seller, admin]` |

**What remains for this module is almost entirely UI** — the data/security
layer exists and is tested. This materially changes the roadmap in §12.

### 1.2 Design system to inherit (from the completed Landing Page)

| Token | Value | Source |
| --- | --- | --- |
| Display font | `font-serif` → DM Serif Display, weight 400 | `app/layout.tsx` |
| Body font | `font-sans` → DM Sans (variable) | `app/layout.tsx` |
| Ink | `rj-black #0D0D0D` | `globals.css` |
| Paper | `rj-white #F8F7F5` | `globals.css` |
| Accent | `rj-red #E8192C`, hover `rj-red-dark #C8111E` | `globals.css` |
| Grays | `rj-gray-{50,100,200,400,600,800}` | `globals.css` |
| Buttons | pill (`rounded-full`), bold, tight tracking, `active:scale-95` | `Hero.tsx`, `LandingNavbar.tsx` |
| Cards | `rounded-xl`/`rounded-2xl`/`rounded-3xl`, `shadow-sm` → `shadow-xl` on hover | `FeaturedShops.tsx` |
| Section labels | `text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red` | every landing section |
| Motion | CSS keyframes (`fadeSlideIn`, `float`) for reveals; Framer Motion `AnimatePresence` reserved for enter/exit UI (mobile nav) | `Reveal.tsx`, `LandingNavbar.tsx` |
| Icons | `lucide-react` | throughout |

**Two design systems coexist in the app today, on purpose:**
- **`rj-*` tokens** — fixed light, editorial, used only by `(marketing)`.
- **Semantic tokens** (`bg-primary`, `text-muted-foreground`, …) — theme-aware
  (light/dark via `prefers-color-scheme`), used by `(shop)` (`Button`, `Card`,
  `FormField`, `ErrorState` already built on these).

**Decision:** Auth screens use the **`rj-*` system**, because sign-in/sign-up
are the direct continuation of the "Sign In" click in `LandingNavbar` — a
theme switch mid-flow (editorial black/red → generic light/dark) would break
continuity right when trust matters most. Auth is visually a **third surface**
(`(auth)` route group, detailed in §6), not a `(shop)` page, even though its
Server Actions/schemas live under `features/auth` same as today.

### 1.3 Component reuse vs. new build

| Existing | Reuse as-is for auth? | Notes |
| --- | --- | --- |
| `components/ui/button.tsx` | **No** — port a pill-shaped `rj-*` variant | Current variants are semantic-token based (`bg-primary`); auth needs `bg-rj-red`/pill to match landing CTAs |
| `components/ui/card.tsx` | **No** — new `AuthCard` on `rj-*` tokens | Same reasoning |
| `components/forms/FormField.tsx` | **Yes**, unchanged | Already accessible (label/id/aria-describedby/role=alert), semantic-token styling reads fine on a white card |
| `components/feedback/ErrorState.tsx` | **Yes**, unchanged | `role="alert"` pattern is exactly right for auth-level errors |
| `types/action.types.ts` (`ActionResult<T>`) | **Yes**, unchanged | Every new action still returns this envelope |

---

## 2. Authentication UX pattern — Modal vs. Dedicated Pages (Task 2)

| | **A. Centered Modal** | **B. Dedicated Pages** |
| --- | --- | --- |
| Deep-linkable (email verification / reset links) | ✗ Supabase redirects to a URL — a modal has no URL to land on | ✓ native |
| Back button / browser history | ✗ breaks or requires custom history hacks | ✓ native |
| Mobile viewport | ✗ cramped, viewport-height constrained | ✓ full-height, no clipping |
| SEO / shareable "Sign in" link | ✗ | ✓ |
| Focus trap / a11y complexity | Higher (must trap focus, restore on close, Radix Dialog or similar) | Lower (page navigation handles focus naturally) |
| Matches this codebase's existing wiring | ✗ `AUTH_ROUTES`, `proxy.ts` redirects, and `app/auth/callback/route.ts` **all assume real routes** | ✓ zero rework |
| Real-world e-commerce precedent | Used only for *lightweight* prompts ("sign in to save this item") | **Shopee, Lazada, Zalora, Amazon all use dedicated pages for the actual login/register flow** |

**Recommendation: Option B — Dedicated Pages.** This isn't close. The PKCE
callback (`app/auth/callback/route.ts`) performs a full server-side redirect
regardless of UI choice — a modal would have to close itself and resync state
after a full navigation anyway, which is strictly worse than just being a
page. `proxy.ts` already treats `/sign-in`, `/sign-up`, `/forgot-password` as
first-class routes with redirect-when-authenticated logic built in.

**Recommended Enhancement (out of core scope):** a lightweight, non-blocking
**"Sign in to continue" prompt** (toast or small popover, not a full auth
modal) for guest actions like adding to cart while signed out — this is the
one place the four reference apps *do* use a lightweight overlay. Not part of
this phase; flagged for later if the capstone scope is extended.

---

## 3. User flow diagrams (Task 3)

### 3.1 Primary flow

```
Landing Page (/)
   │  click "Sign In"
   ▼
┌─────────────┐        ┌──────────────┐
│   Login     │───────▶│   Register   │  ("Create an account" link)
│  /sign-in   │◀───────│   /sign-up   │
└──────┬──────┘        └──────┬───────┘
       │ "Forgot password?"          │ submit (valid)
       ▼                              ▼
┌───────────────┐          ┌────────────────────┐
│ Forgot Password│          │ Email Verification │
│/forgot-password│          │   (pending state,   │
└───────┬────────┘          │ shown inline on the │
        │ submit             │  same /sign-up page)│
        ▼                    └──────────┬──────────┘
  (email sent — always                  │ user clicks link in email
   success, no enumeration)             ▼
        │                     ┌────────────────────┐
        │ user clicks link    │ /auth/callback?code │
        └────────────────────▶│  (PKCE exchange)    │
                               └──────────┬──────────┘
                                          │ success
                                          ▼
                              ┌────────────────────────┐
                              │ Reset Password          │  (only if the link
                              │ /reset-password          │   was a recovery link;
                              │ (recovery session active)│   sign-up links skip
                              └───────────┬──────────────┘   this and go below)
                                          │ submit new password
                                          ▼
                               ┌─────────────────────┐
                               │   Successful Login /  │
                               │   Session established │
                               └───────────┬────────────┘
                                           ▼
                               ┌─────────────────────┐
                               │   Role Detection      │  (read profiles.role
                               │  (getSessionUser)      │   via existing query)
                               └───────────┬────────────┘
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
                   role: buyer        role: seller        role: admin
                        │                  │                  │
                        ▼                  ▼                  ▼
                 Home / Storefront   Seller Dashboard*   Admin Dashboard*
                                    (future module)      (future module)
```
`*` Dashboard routes already reserved in `constants/routes.ts`
(`ROUTES.dashboard`, `ROUTES.inventory`) but their UI is a **future module**,
not part of this phase — only the *redirect target* is planned here.

### 3.2 Logout flow

```
Any authenticated page → "Sign out" → signOutAction()
   → supabase.auth.signOut() → revalidatePath("/", "layout")
   → redirect(ROUTES.signIn)
```
Already implemented exactly this way in `auth.actions.ts`.

### 3.3 Session expiration flow

```
User has a stale/expired session cookie
   → any request hits proxy.ts → updateSupabaseSession()
   → Supabase attempts refresh using the refresh token
        ├─ refresh succeeds → session silently renewed, request continues
        └─ refresh fails (expired/revoked) → user = null
              → if route is in PROTECTED_ROUTE_PREFIXES:
                    redirect to /sign-in?redirectTo=<original path>
              → SignInForm reads redirectTo and returns the user there after
                re-authenticating (already implemented in SignInForm.tsx)
```

### 3.4 Unauthorized access flow

```
Signed-in buyer requests a seller/admin-only route (e.g. /dashboard)
   → proxy.ts sees user != null → passes through (proxy only checks
     "is authenticated", not role — see §8 for why)
   → Server Component/Action calls requireRole(DASHBOARD_ROLES)
   → role not in allowed list → throws
   → caught by the action → ActionResult { success:false, error }
     OR by the route's error boundary for a page-level fetch
   → UI shows an "Unauthorized" ErrorState (reuse existing component)
     with a link back to Home
```

---

## 4. Authentication screens (Task 4)

Every screen below reuses `AuthLayout` + `AuthCard` (§5) for the frame and
differs only in its form content. Each documents Loading / Error / Success
per the existing `ActionResult<T>` contract already used by every action.

### 4.1 Login — `/sign-in`

| Element | Detail |
| --- | --- |
| Logo | `RobertJ` wordmark, links to `/`, same treatment as `LandingNavbar` |
| Welcome message | "Welcome back" (serif headline) + short subtext |
| Email | `EmailInput` (type=email, autoComplete="email") |
| Password | `PasswordInput` with visibility toggle |
| Forgot password | Inline link, right-aligned above/below password field (matches Shopee/Lazada placement) |
| Submit | `AuthButton` full-width, `isLoading` while pending |
| Register link | "New to RobertJ? Create an account" below the card |
| **Loading** | Button shows spinner + disabled (pattern already in `Button.isLoading`) |
| **Error** | `ErrorState`-style inline banner above the form (invalid credentials — generic message, no "email not found" enumeration) |
| **Success** | Redirect via `router.replace(redirectTo ?? ROUTES.home)` — already implemented |

Fields are exactly what `signInSchema` validates today — no new schema work.

### 4.2 Register — `/sign-up`

Fields limited to what `profiles`/`auth.users` actually support (no schema
change, per Task 7):

| Field | Column it maps to |
| --- | --- |
| Full name | `profiles.full_name` (via `signUp` `options.data.full_name`, consumed by the `handle_new_user` trigger) |
| Email | `auth.users.email` |
| Password | `auth.users` (hashed by Supabase) |
| Confirm password | client-side only equality check, not persisted |

No username/phone/bio/avatar at registration — those exist on `profiles` but
are **profile-editing fields**, out of scope for sign-up (documented as
**Recommended Enhancement**, not core).

Role is **never a form field** — `profiles.role` defaults to `buyer` and can
only change via the `prevent_role_self_escalation` trigger-guarded path
(seller upgrade is a separate, future flow, not part of registration).

- **Loading:** button spinner, form disabled.
- **Error:** field-level via `FormField errors=`, form-level via `ErrorState`
  (e.g. "email already registered" — Supabase returns this distinctly from
  validation errors).
- **Success:** inline transition to the **Email Verification** pending state
  on the same page (not a redirect) — avoids a dead-end route for a state
  that isn't really a separate page.

### 4.3 Forgot Password — `/forgot-password`

- Single `EmailInput` + submit.
- **Success state is always the same** regardless of whether the email
  exists — `requestPasswordResetAction` already implements this
  (never leaks which emails are registered). Copy: "If an account exists for
  that email, we've sent a reset link."
- No error state that reveals account existence (OWASP guidance, §9).

### 4.4 Reset Password — `/reset-password`

- Reached only via the PKCE callback after a recovery-link click (session
  becomes a "recovery session").
- Two `PasswordInput` fields (new password, confirm) — `resetPasswordSchema`
  already validates match + length.
- **Guard:** if this route is hit without an active recovery session
  (`getSessionUser()` returns null), show an `ErrorState` ("This link has
  expired") with a link back to Forgot Password, not the form.
- **Success:** confirmation message + auto-redirect to Home (already
  signed-in at this point) after a short delay, or an explicit "Continue"
  button (accessibility: don't force a timed redirect without a way to skip).

### 4.5 Email Verification

Not a standalone route — a **state within `/sign-up`** (see §4.2) plus the
shared `/auth/callback` handler that actually completes it. UI needs:
- Pending state: "Check your email" illustration/icon, the address it was
  sent to, and a "Resend email" action (`resendVerificationEmail` already
  implemented — needs basic rate-limit-aware UI, e.g. disable for 30s after
  sending).

---

## 5. Component architecture (Task 5)

```
features/auth/components/
├── layout/
│   ├── AuthLayout.tsx      Full-bleed rj-* shell (split panel on desktop,
│   │                       stacked on mobile) — wraps every auth page
│   ├── AuthCard.tsx        The white/black card holding a form; radius +
│   │                       shadow lifted from FeaturedShops card treatment
│   ├── AuthHeader.tsx      Logo + serif headline + subtext (varies per screen)
│   └── AuthFooter.tsx      Small-print links (switch between Login/Register,
│                           back to Home) — single component, content via props
│
├── forms/
│   ├── LoginForm.tsx           Wraps signInAction + signInSchema
│   ├── RegisterForm.tsx        Wraps signUpAction + signUpSchema
│   ├── ForgotPasswordForm.tsx  Wraps requestPasswordResetAction
│   └── ResetPasswordForm.tsx   Wraps updatePasswordAction
│
├── fields/
│   ├── EmailInput.tsx      Thin wrapper over existing FormField
│   │                       (type=email, consistent autoComplete/icon)
│   └── PasswordInput.tsx   FormField + visibility toggle (Eye/EyeOff from
│                           lucide-react) — the one genuinely new input
│
└── feedback/
    ├── AuthDivider.tsx     "or" rule between form and secondary actions
    └── VerificationPending.tsx   The §4.5 "check your email" state
```

**Responsibility table:**

| Component | Owns | Does NOT own |
| --- | --- | --- |
| `AuthLayout` | Page-level chrome, background, responsive split | Form logic |
| `AuthCard` | Visual container only | Any auth-specific copy |
| `AuthHeader`/`AuthFooter` | Copy + navigation links | Validation |
| `*Form` components | Wiring `useActionState` to the existing action + schema, rendering `EmailInput`/`PasswordInput`/`FormField`, submit button | Network calls (that's the action/query layer, already built) |
| `EmailInput`/`PasswordInput` | Field-level markup + a11y attributes | Validation messages (still passed in via `errors` prop, same contract as `FormField`) |

**Explicitly reused, not duplicated:** `Button` (new `rj-*` variant added,
not a parallel button component), `FormField`, `ErrorState`,
`ActionResult<T>`, `LoadingState`/`Skeleton` if any auth screen needs a
suspense fallback (unlikely — these are all fast, small forms).

**`LoadingOverlay` from the original task list is intentionally NOT built as
a separate component** — every existing action already returns fast, and
`Button.isLoading` covers the interaction. A full-page overlay would be
inconsistent with how loading is handled everywhere else in this codebase
(`ProductGridSkeleton`, `Button.isLoading`). Documented here as a deliberate
omission, not an oversight.

---

## 6. Folder structure (Task 6)

```
src/
├── app/
│   └── (auth)/                        NEW route group — full-bleed, no shop
│       │                              chrome, same principle as (marketing)
│       ├── layout.tsx                 Renders AuthLayout
│       ├── sign-in/page.tsx           MOVE from current app/(shop)/sign-in
│       ├── sign-up/page.tsx           NEW
│       ├── forgot-password/page.tsx   NEW
│       └── reset-password/page.tsx    NEW
│
└── features/auth/
    ├── actions/auth.actions.ts        [existing] no change needed
    ├── components/                    [existing SignInForm.tsx relocates
    │                                   under forms/, structure per §5]
    ├── schemas/auth.schema.ts         [existing] no change needed
    ├── index.ts                       [existing] extend exports as new
    │                                  components/actions are added
    └── constants/                     NEW — screen copy (headlines,
                                        subtext) kept out of components,
                                        same pattern as
                                        features/landing/constants
```

**Why `sign-in` moves out of `(shop)`:** it currently lives there only
because `(marketing)`/`(shop)` were the only two groups that existed when the
landing phase shipped. Auth is neither storefront chrome nor full-bleed
marketing — it's a third, minimal-chrome surface. Moving it is a pure folder
move (same pattern used to relocate `products`/`cart` into `(shop)` last
phase), not a rewrite.

| Folder | Responsibility |
| --- | --- |
| `actions/` | `"use server"` — Zod-parse `FormData`, call a query function, return `ActionResult<T>`. Never touches Supabase directly. |
| `components/layout/` | Chrome shared by every auth screen |
| `components/forms/` | One component per screen, each owning exactly one action |
| `components/fields/` | Reusable input primitives specific to auth's needs |
| `components/feedback/` | States that aren't just `ErrorState`/`Button.isLoading` |
| `schemas/` | Zod — already complete |
| `constants/` | Screen copy, kept separate so a copy change isn't a component change |

`hooks/`, `services/`, `types/`, `utils/` are in the standard feature
skeleton but currently empty for `auth` — the query layer lives centrally in
`lib/supabase/queries.ts` per the prior phase's consolidation decision, so
`features/auth/services/` stays empty by design (documented in
`lib/supabase/queries.ts`'s own header comment already).

---

## 7. Database integration plan (Task 7)

**No schema changes.** Mapping only.

| Concern | How it's answered today |
| --- | --- |
| Tables used | `auth.users` (Supabase-managed) + `public.profiles` only |
| `auth.users` → `profiles` link | 1:1, `profiles.id` FK → `auth.users.id`, `ON DELETE CASCADE` (per `docs/database.md` §2) |
| Profile creation | The `handle_new_user` trigger (already in the migration) fires on `auth.users` insert and creates the matching `profiles` row, reading `full_name` out of `signUp`'s `options.data` — exactly what `signUpWithPassword` in `queries.ts` already sends |
| Role retrieval | `getSessionUser()` in `queries.ts` selects `profiles.role` (default `buyer`) — already implemented |
| Role escalation prevention | `prevent_role_self_escalation` trigger — DB-enforced, nothing for this module to build |
| Session validation | `supabase.auth.getUser()` server-side (never trusts a client-supplied session blindly) — already how `getSessionUser` works |
| Session refresh | `updateSupabaseSession()` in `lib/supabase/session.ts`, run by `proxy.ts` on every request — already implemented |

This module's job is **UI that calls what's already there** — there is no
new database work in this phase.

---

## 8. Route protection strategy (Task 8)

| Route class | Examples | Enforcement |
| --- | --- | --- |
| Public | `/`, `/products`, `/products/[slug]`, **`/cart`** | No check — **`/cart` is an intentional guest cart** (see note below) |
| Guest-only | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | `proxy.ts` `AUTH_ROUTES` — redirects an already-authenticated user to Home |
| Protected (any role) | `/checkout`, `/orders`, `/notifications`, `/profile` (future) | `proxy.ts` `PROTECTED_ROUTE_PREFIXES` — redirects to `/sign-in?redirectTo=...` |
| Seller/Admin-only | `/dashboard`, `/dashboard/inventory` | **Not** middleware — see below |
| Admin-only | *(none yet reserved — future module)* | Same pattern as seller/admin when it exists |

**Guest cart decision (recorded):** `/cart` stays accessible without
authentication. The cart is a client-owned, `localStorage`-persisted surface
(`features/cart` — `CartProvider`/`useReducer`), so browsing it costs nothing
and requiring sign-in would add friction mid-shopping. Only the *actions that
commit* the cart — Checkout, Orders, Notifications, Dashboard, Profile, and
any account-specific mutations — are gated by `PROTECTED_ROUTE_PREFIXES` or
`requireSessionUser()` at the action level. A lightweight non-blocking "Sign
in to continue" prompt for guest add-to-cart/checkout actions remains the
documented Recommended Enhancement (§2), not a hard redirect.

**Why role checks stay out of `proxy.ts`:** middleware runs on every request
and only has the session cookie — checking `role` would mean an extra
`profiles` fetch per request across the whole app, not just the few
dashboard routes that need it. The existing `requireRole()` in
`queries.ts` already does this check exactly where it's needed (inside the
Server Component/Action for the protected page), which is cheap because it
only runs when that specific route is hit. This mirrors `docs/database.md`'s
own stated philosophy: **RLS is the final enforcement layer**, and
`proxy.ts` is "a redirect convenience, not the security boundary." Role
checks slot into that same layered model one level up.

**Redirect behavior:**
- Protected + signed out → `/sign-in?redirectTo=<path>` (implemented)
- Guest-only + signed in → `/` (implemented)
- Wrong role → `requireRole` throws → caught by the action/page → render an
  `ErrorState` "Unauthorized" (not a silent redirect, so the user understands
  *why*, per WCAG error-identification guidance)

---

## 9. Security checklist (Task 9)

- [x] **Password rules** — `signInSchema`/`signUpSchema` already enforce
      min-8 (`resetPasswordSchema` matches). *(Recommended Enhancement:
      OWASP ASVS suggests a max length ~128 and a breach-list check via
      Supabase's built-in leaked-password protection — a Supabase project
      setting, not app code; flagged for the implementation phase to enable.)*
- [x] **No user enumeration** — forgot-password always returns the same
      success message (already implemented in `requestPasswordResetAction`).
- [x] **Session validation never trusts the client** — `getUser()` is used
      (revalidates against Supabase), not a decoded-locally JWT read.
- [x] **Role escalation blocked at the DB layer**, not just the UI —
      trigger-enforced, so even a bypassed client can't self-promote.
- [x] **PKCE flow** for email links (`/auth/callback`), not implicit grant —
      already the pattern in `@supabase/ssr`.
- [x] **Open-redirect guard** — `authCallback`'s `next` param is checked to
      start with `/` before use (already implemented).
- [x] **Generic error messages** on login failure — never "wrong password"
      vs "no such user" distinctly.
- [ ] **Rate limiting** on sign-in/forgot-password — Supabase applies
      platform-level rate limits by default; no additional app code needed
      unless abuse is observed (documented as a watch-item, not a build item).
- [x] **CSRF** — Server Actions are POST-only and Next.js issues an
      encrypted action-bound token automatically; no additional CSRF token
      needed for same-origin form submissions in this architecture.
- [x] **Errors never leak stack traces to the client** — every action
      already catches and maps to a plain string via
      `error instanceof Error ? error.message : "..."`.
- [ ] **Loading states prevent double-submit** — `Button.isLoading` disables
      the button; confirm every new `*Form` disables submit while
      `isPending` (implementation-time checklist item, not a design gap).

---

## 10. Responsive design plan (Task 10)

| Breakpoint | Tailwind | Layout |
| --- | --- | --- |
| Mobile | `< 640px` | Single column, full-bleed `AuthCard` (no side padding beyond the landing's `px-5`), logo centered top |
| Tablet | `640–1023px` | Centered `AuthCard`, max-width ~440px, generous vertical padding, background visible around the card |
| Desktop/Laptop | `≥ 1024px (lg)` | Split panel — left: editorial image/copy (reuse a landing asset + a headline, same visual language as `Hero`'s left column); right: the `AuthCard`. Mirrors the pattern Shopee/Lazada use on desktop. |
| Wide desktop | `≥ 1280px (xl)` | Same split, wider breathing room, card stays capped at ~440px so line length stays readable |

`AuthLayout` is the single place this logic lives — every screen (`Login`,
`Register`, `Forgot`, `Reset`) reuses it unchanged, only `AuthCard`'s
children differ.

---

## 11. Accessibility checklist (Task 11)

- [x] **Semantic HTML** — `<form>`, `<label htmlFor>` (already how
      `FormField` works), `<button type="submit">`.
- [x] **Keyboard navigation** — native focusable elements only, no custom
      click-only controls; tab order follows visual order top-to-bottom.
- [ ] **Focus trap** — N/A, since §2 recommends dedicated pages over a
      modal; noted here so it's explicit *why* this checklist item is
      skipped, not silently dropped.
- [x] **Escape key** — N/A for the same reason.
- [x] **ARIA labels** — password-visibility toggle button needs
      `aria-label="Show password"` / `"Hide password"` (dynamic), matching
      the pattern already used for icon-only buttons in `LandingNavbar`
      (`aria-label="Open search"` etc.).
- [x] **Error announcements** — `FormField` already sets
      `role="alert"` on field errors and `aria-invalid`/`aria-describedby`;
      `ErrorState` already uses `role="alert"` for form-level errors. Reused
      as-is, not reinvented.
- [x] **Screen reader compatibility** — no icon conveys meaning without an
      accompanying label or `aria-hidden` + text alternative (matches the
      `aria-hidden="true"` convention already used throughout the landing
      icons).
- [x] **WCAG contrast** — `rj-red` (#E8192C) on `rj-white` (#F8F7F5) and
      `rj-black` on `rj-white` both already pass AA at the text sizes used
      on the landing page; the same pairs are reused here, not new
      combinations that would need re-verification.
- [x] **Visible focus states** — inherited from `focus-visible:ring-2`
      convention already on `Button`/`FormField`; the new `rj-*` button
      variant must keep an equivalent visible ring (not omit it for
      aesthetics).

---

## 12. Implementation roadmap (Task 12)

Because the data/action/schema layer is **already built**, this roadmap is
front-loaded toward UI, not backend plumbing:

| Phase | Scope | Why this order |
| --- | --- | --- |
| **1. Shared auth chrome** | `AuthLayout`, `AuthCard`, `AuthHeader`, `AuthFooter`, `AuthDivider`, the `rj-*` `Button` variant | Every screen depends on these; building them once avoids four slightly-different headers |
| **2. Field primitives** | `EmailInput`, `PasswordInput` (with toggle) | Used by every form next; `PasswordInput` is the only genuinely new input |
| **3. Route group** | `(auth)` layout + move `sign-in` in, stub the other three pages | Establishes the URLs early so `redirectTo`/callback links are testable immediately |
| **4. Login** | `LoginForm` in the new chrome | Already has a working action/schema — lowest-risk screen to prove the chrome works end-to-end |
| **5. Register** | `RegisterForm` + inline `VerificationPending` state | Second-lowest risk; action/schema already exist |
| **6. Forgot Password** | `ForgotPasswordForm` | Simple, one field, action exists |
| **7. Reset Password** | `ResetPasswordForm` + recovery-session guard | Depends on the callback route, which is already implemented and tested — safe to build last of the forms |
| **8. Role-based redirect** | Post-login redirect target logic (buyer → home, seller/admin → dashboard stub route) | Needs Login working first; dashboard itself is a future module, so this phase only wires the *redirect*, not the destination page |
| **9. QA pass** | Manual flow-through of every diagram in §3, responsive check per §10, a11y pass per §11, security checklist per §9 | Standard: verify integration after all pieces exist, matching how the landing phase closed with a fidelity + build/typecheck/lint pass |

---

## 13. Explicit scope boundaries

**In scope (this document plans, next phase builds):** Login, Register,
Forgot Password, Reset Password, Email Verification (as a sign-up substate),
Logout, session expiration handling, role-based redirect *target selection*,
`(auth)` route group.

**Recommended Enhancements (out of core scope, not to be built without
separate approval):**
- Lightweight "sign in to continue" prompt for guest cart actions (§2).
- Leaked-password protection toggle in Supabase project settings (§9).
- Profile-editing fields (username, phone, bio, avatar) at registration (§4.2) —
  these belong to a future Profile module, not sign-up.
- Seller-upgrade flow (buyer → seller role change) — explicitly not part of
  registration; the trigger that prevents self-escalation implies this needs
  its own reviewed flow later.
- Social/OAuth sign-in — not mentioned anywhere in the brief; not assumed.

Anything not listed as in-scope above should be treated as out of the
capstone's documented scope until explicitly requested.
