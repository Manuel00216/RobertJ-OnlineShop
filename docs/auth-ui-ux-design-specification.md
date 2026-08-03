# Authentication Module — UI/UX Design Specification

> Status: **Version 1.0 — DESIGN FREEZE.** No implementation code in this
> document. This extends `docs/auth-module-architecture-plan.md`
> (architecture, flows, folder structure, security, roadmap already
> approved) with the visual and interaction detail needed to implement
> without further design decisions.
>
> Every value below is traced to its source in the already-built Landing
> Page, not invented — see §1's citation table.
>
> **From this version forward, implementation must follow this
> specification exactly** unless a bug, accessibility issue, or approved
> scope change requires an update (tracked as a versioned amendment, §13.3).
>
> **Revision history:** v1.0 — design freeze, after the §12 design-to-Figma
> verification and §13 QA gate cleared the pre-implementation audit.

---

## 1. Visual language extraction (source of truth)

Every token, size, and effect used anywhere in this spec is lifted directly
from an existing landing component. Nothing here is a new design decision
made in isolation.

| Token | Value | Reused from |
| --- | --- | --- |
| Display font | `font-serif` — DM Serif Display, weight 400 | `Hero.tsx` headline |
| Body font | `font-sans` — DM Sans (variable) | global default |
| Ink | `rj-black` `#0D0D0D` | `globals.css` |
| Paper | `rj-white` `#F8F7F5` | `globals.css` |
| Accent | `rj-red` `#E8192C`, hover `rj-red-dark` `#C8111E` | `globals.css` |
| Section surface | `rj-gray-50` `#F5F4F2` | `AboutSection.tsx` background |
| Borders | `rj-gray-100` `#EBEBEB` / `rj-gray-200` `#D4D4D4` | `FeaturedProductsGrid.tsx`, `LandingNavbar.tsx` search box |
| Muted text | `rj-gray-400` `#9B9B9B` / `rj-gray-600` `#6B6B6B` | throughout |
| Dark surface | `rj-gray-800` `#2D2D2D`, `#0A0A0A`/`#1A1A1A` | `SmartAssistantPreview.tsx`, `LandingFooter.tsx` |
| Success | `rj-green` `#22C55E` | `LandingFooter.tsx` trust badges, `SmartAssistantPreview.tsx` online dot |
| Eyebrow label | `text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red` | every section kicker (`FeaturedShops`, `AboutSection`, `MarketplaceFeatures`) |
| Primary CTA | `rounded-full bg-rj-red px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-rj-red/25 transition-all hover:bg-rj-red-dark active:scale-95` | `Hero.tsx` "Shop Now" |
| Outline button (light bg) | `rounded-full border-[1.5px] border-rj-black py-2 text-[12px] font-bold text-rj-black hover:bg-rj-black hover:text-rj-white transition-colors` | `FeaturedShops.tsx` "Visit Shop" |
| Text link w/ arrow-hover | `inline-flex items-center gap-2 text-[13px] font-bold text-rj-red hover:gap-3 transition-all` | `AboutSection.tsx` "Our Story" |
| Card radius (hero-weight) | `rounded-3xl`, `shadow-2xl` | `Hero.tsx` main card, `SmartAssistantPreview.tsx` chat container |
| Card radius (standard) | `rounded-2xl`, `shadow-sm` → `shadow-xl` on hover | `FeaturedShops.tsx` shop cards |
| Image/tile radius | `rounded-xl` | `FeaturedProductsGrid.tsx` product images, `ProductCategories.tsx` |
| Entrance animation | `style={{ animation: "fadeSlideIn 0.7s ease both" }}` | `Hero.tsx` left column |
| Delayed entrance | `fadeSlideIn 0.7s ease 0.2s both` | `Hero.tsx` right column |
| Pop-in (badges/counters) | `@keyframes pop` (`0% scale(.6) → 60% scale(1.2) → 100% scale(1)`) | `LandingNavbar.tsx` cart-count badge |
| Ambient glow accent | `absolute ... bg-rj-red/8 blur-[120px] rounded-full` (or `/15 blur-2xl` smaller) | `Hero.tsx` background glow, `AboutSection.tsx` red accent |
| Reduced motion | global `prefers-reduced-motion` override in `globals.css` | already applies automatically — no auth-specific work needed |

**AA usage note on the accent color (verified):** `rj-red` (#E8192C) on
`rj-white` (#F8F7F5) is **≈4.26:1** — above the 3:1 large/non-text bar but
*below* the 4.5:1 normal-text bar. So wherever small red *text* appears
(links, eyebrows, emphasis) this spec uses **`text-rj-red-dark`** (#C8111E,
**≈5.5:1** on `rj-white` — already an existing landing hover token, so **no new
token is introduced**). `rj-red` is reserved for: the CTA background (white
on `rj-red` ≈4.56:1 ✓), display/large text, icons, and the focus ring. This is
the AA-safe reading of the landing's own red link color (the landing's
13px red links sit at ≈4.26:1, under AA for normal text; auth adopts the
compliant variant).

**New values this spec introduces (justified, not arbitrary — no new color
tokens):**

| New value | Where | Why it's not a landing token |
| --- | --- | --- |
| Text-input shape: `rounded-xl border border-rj-gray-600 bg-rj-white px-4 py-3 focus:ring-2 focus:ring-rj-red/30 focus:border-rj-red` | `EmailInput`, `PasswordInput` | The landing's only text input is `LandingNavbar`'s search box, styled `rounded-full` — correct for a compact icon+text combo, wrong for a standalone full-width field (a full pill on a 300px+ wide email input reads oddly and hurts scanability per Nielsen Norman form guidance). `rounded-xl` isn't invented either — it's the landing's own "image/tile" radius (product photos, category tiles), reused here in a new context rather than a fourth radius value being introduced. **Resting border (AA, 1.4.11):** the palette was checked first — `rj-gray-200` (#d4d4d4) ≈1.4:1 and `rj-gray-400` (#9b9b9b) ≈2.6:1 both fail the 3:1 non-text requirement, while existing **`rj-gray-600` (#6b6b6b) ≈5.0:1 passes**, so the resting border reuses that token. **No new color token is introduced**; focus is `ring-rj-red/30` + `border-rj-red` as before. |

---

## 2. Shared shell — `AuthLayout` (used by all 5 screens)

The layout is the single place responsive behavior and background treatment
live. Every screen below only differs in its `AuthCard` **content**.

### 2.1 Desktop / laptop (`≥ 1024px`, Tailwind `lg:`)

Split panel, directly mirroring `Hero.tsx`'s two-column structure at the
scale of a form instead of a hero:

```
┌──────────────────────────────────────────┬────────────────────────────────┐
│  LEFT PANEL — bg-rj-black                 │  RIGHT PANEL — bg-rj-white     │
│  (≈ 45% width, min-h-screen)              │  (≈ 55% width)                 │
│                                            │                                │
│  [RobertJ wordmark]  ← links home          │        ┌──────────────┐        │
│                                            │        │  AuthCard    │        │
│  ┌ eyebrow ─────────────────────┐          │        │ (max-w-440px)│        │
│  │ PHILIPPINES' MULTI-SHOP       │          │        │              │        │
│  │ MARKETPLACE                   │          │        │  [content]   │        │
│  └────────────────────────────────┘         │        │              │        │
│                                            │        └──────────────┘        │
│  Welcome Back.        ← font-serif,        │                                │
│  Every Style.           text-[clamp(2.5rem,│                                │
│                          5vw,4rem)]         │                                │
│  (per-screen headline,                     │                                │
│   see §3–7)                                │                                │
│                                            │                                │
│  Short supporting copy, max-w-sm,          │                                │
│  text-rj-gray-400                          │                                │
│                                            │                                │
│  ● ambient red glow blur, bottom-left      │                                │
│    (bg-rj-red/8 blur-[120px])              │                                │
└──────────────────────────────────────────┴────────────────────────────────┘
```

- Left panel background: `bg-rj-black` with the same
  `bg-rj-red/8 blur-[120px] rounded-full` ambient glow as `Hero.tsx`
  (positioned `bottom-0 left-0`), **no photographic background image** —
  auth pages are functional, not editorial-first, so the image-heavy hero
  treatment is intentionally dialed back to just typography + glow. This
  keeps load weight near-zero on the page users hit most often per session.
- The `RobertJ` wordmark is the **shared `Wordmark` component** from
  `src/components/brand/` (see §7) — the same one the landing navbar uses,
  extracted rather than re-created, so there is a single source of truth.
- Left-panel headline/copy **change per screen** (see each screen's section)
  so the page reinforces what the user is doing, matching the pattern
  Zalora/Shopee use ("Welcome back" vs "Join us" vs "Reset your password").
- **Eyebrow on the dark panel is light** (`text-rj-gray-200`), not red:
  `rj-red` on `rj-black` is ≈4.1:1, under the 4.5:1 normal-text bar. The
  red eyebrow token is used only on light surfaces (§1 AA note).
- Right panel: plain `bg-rj-white`, card centered both axes,
  `px-8` outer gutter matching the landing's `px-5 md:px-8` convention.

### 2.2 Tablet (`768–1023px`, Tailwind `md:` — aligned with the Landing Page)

No split — single column, centered card on a **distinct section
background**, reusing `AboutSection.tsx`'s `bg-rj-gray-50` page treatment so
the white `AuthCard` reads as a raised surface against it (the same
figure/ground relationship the landing already uses between white shop
cards and the black `ProductCategories` section). The `md:` prefix is the
exact tablet token the landing uses (`md:px-8`, `md:col-span-2` bento) — no
custom breakpoint.

```
┌────────────────────────────────────────────┐
│  bg-rj-gray-50, min-h-screen                │
│                                              │
│              [RobertJ wordmark]              │
│                                              │
│           ┌──────────────────────┐          │
│           │  AuthCard             │          │
│           │  rounded-3xl           │          │
│           │  shadow-xl              │          │
│           │  border border-rj-gray-100 │       │
│           │  bg-rj-white            │          │
│           │  max-w-[440px]          │          │
│           │  p-8 md:p-10             │          │
│           │                          │          │
│           │      [content]           │          │
│           │                          │          │
│           └──────────────────────┘          │
│                                              │
└────────────────────────────────────────────┘
```

### 2.3 Mobile (`< 768px`, base — no Tailwind prefix)

**No floating card at all** — deliberate departure from tablet/desktop,
matching how Shopee/Lazada's mobile web auth behaves like a native app
screen, not a boxed dialog shrunk to fit. Everything below is the base
stylesheet (below `md:`), same as the landing treats sub-`md:` viewports:

```
┌───────────────────────────┐
│  bg-rj-white               │
│  px-6 pt-10 pb-8            │
│                             │
│  [← Back]      (if nested) │
│                             │
│  [RobertJ wordmark]         │
│                             │
│  eyebrow (optional,         │
│  omitted if tight on space) │
│                             │
│  Headline (font-serif,      │
│  text-[28px] leading-tight) │
│                             │
│  Supporting copy             │
│                             │
│  [form fields, full width]  │
│                             │
│  [primary button, full-w]   │
│                             │
│  [secondary links]          │
│                             │
└───────────────────────────┘
```

- Card border/shadow are **omitted** (both surfaces are `rj-white` — a
  border here would be pure decoration, not a boundary that means anything;
  removing it also removes the "why is there a rectangle with nothing
  behind it" visual bug a naive port would introduce).
- The visible "Back" affordance replaces the desktop panel's implicit
  context (no left panel to explain where you are), so it appears only on
  mobile — a genuinely different, considered layout, not just a squeezed
  desktop one.

---

## 3. Screen — Login (`/sign-in`)

**Left panel copy (desktop):**
- Eyebrow: `WELCOME BACK`
- Headline: *"One Place.<br/>Every Style."* — reused verbatim from `Hero.tsx`
  (same brand line, since Login is the direct continuation of clicking
  "Sign In" from that exact hero) with `Every` in `<em class="not-italic
  text-rj-red">`, matching the hero's emphasis treatment exactly.
- Supporting line: *"Sign in to pick up where you left off."*

**AuthCard content:**

```
┌───────────────────────────────────────┐
│  RobertJ [wordmark, mobile/tablet only;│
│  desktop shows it in the left panel]   │
│                                         │
│  Sign In                 ← font-serif, │
│                             text-[32px]│
│  New here? Create an account  ← link,  │
│  text-sm text-rj-gray-600, "Create an  │
│   account" in rj-red-dark font-semibold │
│                                         │
│  Email                                 │
│  [ ✉  you@example.com            ]     │
│                                         │
│  Password              Forgot password?│
│  [ 🔒 ••••••••••••••        👁 ]        │
│                                         │
│  [        Sign In (primary CTA)     ]  │
│                                         │
└───────────────────────────────────────┘
```

| Element | Spec |
| --- | --- |
| Card headline | `font-serif text-[32px] leading-[1.1] text-rj-black` — "Sign In" |
| Register prompt | Directly under headline (not buried in footer) — matches Zalora/Shopee placement; `text-sm text-rj-gray-600`, link segment `text-rj-red-dark font-semibold hover:underline` |
| `EmailInput` | Leading `Mail` icon (lucide, `h-4 w-4 text-rj-gray-400`), placeholder `you@example.com`, `type="email"`, `autoComplete="email"` |
| `PasswordInput` | Leading `Lock` icon, trailing `Eye`/`EyeOff` toggle button (`h-11 w-11` hit area, `aria-label` swaps "Show password"/"Hide password"), `autoComplete="current-password"` |
| Forgot-password link | Right-aligned on the same row as the "Password" label, `text-xs font-semibold text-rj-red-dark hover:underline` |
| Submit button | Full-width primary CTA per §1 token, label "Sign In", `isLoading` spinner replaces label area (reusing `Button`'s existing spinner markup) |
| Footer (below card) | None extra — the register prompt above already covers it, avoiding the redundant "don't have an account? register" *twice* pattern some competitors have |

---

## 4. Screen — Register (`/sign-up`)

**Left panel copy (desktop):**
- Eyebrow: `JOIN THE MARKETPLACE`
- Headline: *"Every Shop.<br/>One Account."*
- Supporting line: *"Create your account to shop 120+ verified sellers."*

**AuthCard content (default state):**

```
┌───────────────────────────────────────┐
│  Create Account                        │
│  Already a member? Sign in             │
│                                         │
│  Full Name                             │
│  [ 👤  Juan Dela Cruz              ]    │
│                                         │
│  Email                                 │
│  [ ✉  you@example.com              ]    │
│                                         │
│  Password                              │
│  [ 🔒 ••••••••••••••          👁 ]      │
│  Must be at least 8 characters          │   ← hint text, text-xs
│                                         │      text-rj-gray-600
│  Confirm Password                      │
│  [ 🔒 ••••••••••••••          👁 ]      │
│                                         │
│  [     Create Account (primary)     ]  │
│                                         │
│  By continuing, you agree to our Terms │  ← text-[11px]
│  and Privacy Policy.                   │     text-rj-gray-600
└───────────────────────────────────────┘
```

| Element | Spec |
| --- | --- |
| Fields | Full Name → Email → Password → Confirm Password, exactly the order the eye scans top-to-bottom by increasing sensitivity (Baymard-recommended ordering) |
| Password hint | Shown **before** an error occurs (proactive, not just reactive) — `text-xs text-rj-gray-600` under the field (≈5.0:1, AA), switches to `text-rj-red-dark` only once validation actually fails (the AA-safe small-text red, §1) |
| Legal microcopy | Present but not a checkbox — this schema doesn't model consent capture; text-only disclosure, links styled `text-rj-black underline underline-offset-2 hover:text-rj-red-dark` |
| Submit | Same primary CTA treatment, label "Create Account" |

**Post-submit success — inline substate (same page, no navigation):**

```
┌───────────────────────────────────────┐
│                                         │
│              ✉  (icon in a             │
│           rj-red/15 circle,            │
│         pop-in via @keyframes pop)     │
│                                         │
│         Check Your Email                │  font-serif text-2xl
│                                         │
│  We sent a verification link to         │  text-sm text-rj-gray-600
│  juan@example.com. Click it to          │
│  activate your account.                 │
│                                         │
│  [   Resend email (outline button)  ]  │  disabled 30s after send,
│                                         │  label becomes "Resend in 27s"
│  Wrong email? Go back                   │  text link → resets form
└───────────────────────────────────────┘
```

This is the **Email Verification** experience (Task list's 5th screen) —
confirmed in the architecture plan as a substate of Register, not a
separate route, because there is nothing to route *to* until the user
clicks the emailed link.

---

## 5. Screen — Forgot Password (`/forgot-password`)

**Left panel copy (desktop):**
- Eyebrow: `ACCOUNT RECOVERY`
- Headline: *"Forgot Your<br/>Password?"*
- Supporting line: *"No worries — we'll send you a reset link."*

**AuthCard content:**

```
┌───────────────────────────────────────┐
│  ← Back to Sign In      ← text link,   │
│                            top of card, │
│                            ArrowLeft    │
│                            icon         │
│                                         │
│  Reset Your Password                    │  font-serif text-[28px]
│                                         │
│  Enter the email associated with your   │  text-sm text-rj-gray-600
│  account and we'll send a reset link.   │
│                                         │
│  Email                                  │
│  [ ✉  you@example.com               ]   │
│                                         │
│  [      Send Reset Link (primary)    ]  │
└───────────────────────────────────────┘
```

**Success state (replaces the form in place, same card):**

```
┌───────────────────────────────────────┐
│              ✅  (pop-in, rj-green/15   │
│                   circle)               │
│                                         │
│         Check Your Inbox                │
│                                         │
│  If an account exists for that email,   │  ← intentionally
│  we've sent a link to reset your        │     non-committal copy
│  password. The link expires in 1 hour.  │     (no enumeration —
│                                         │      see security §9 of
│  ← Back to Sign In                      │      the architecture doc)
└───────────────────────────────────────┘
```

---

## 6. Screen — Reset Password (`/reset-password`)

Reached only from the emailed link via `/auth/callback`. Two states:

**A. Valid recovery session:**

```
┌───────────────────────────────────────┐
│  Set a New Password                     │  font-serif text-[28px]
│                                         │
│  Choose a strong password you haven't   │  text-sm text-rj-gray-600
│  used before.                           │
│                                         │
│  New Password                           │
│  [ 🔒 ••••••••••••••           👁 ]      │
│  Must be at least 8 characters           │
│                                         │
│  Confirm New Password                   │
│  [ 🔒 ••••••••••••••           👁 ]      │
│                                         │
│  [      Update Password (primary)   ]   │
└───────────────────────────────────────┘
```

Password hints here use the shared `PasswordInput` spec (§4): `text-xs
text-rj-gray-600`, switching to `text-rj-red-dark` once validation fails.

**B. No/expired recovery session (guard state — this is the "Error" state
for this screen, per the architecture plan's §4.4 guard):**

```
┌───────────────────────────────────────┐
│              ⚠  (rj-red/15 circle,      │
│                  no pop animation —     │
│                  this isn't a           │
│                  celebratory moment)    │
│                                         │
│        This Link Has Expired             │
│                                         │
│  Password reset links expire after 1     │
│  hour for your security. Request a new   │
│  one below.                              │
│                                         │
│  [   Request New Link (primary CTA,   ] │  → routes to
│  [   routes to Forgot Password)        ] │    /forgot-password
└───────────────────────────────────────┘
```

**Success (after update):**

```
┌───────────────────────────────────────┐
│              ✅  (pop-in)               │
│                                         │
│        Password Updated                 │
│                                         │
│  Your password has been changed. You're  │
│  all set.                                │
│                                         │
│  [   Continue to RobertJ (primary)   ]  │  explicit button, not a
│                                         │  forced auto-redirect
│                                         │  (WCAG 2.2.1 — no timing)
└───────────────────────────────────────┘
```

---

## 7. Component hierarchy

```
AuthLayout                                    [NEW] shared shell, §2
├── EditorialPanel (desktop only, lg:flex)     [NEW] left black panel
│   ├── wordmark link → "/"                    [REUSE — shared `Wordmark`
│   │                                            from src/components/brand/]
│   ├── eyebrow                                [REUSE style — landing
│   │                                            eyebrow token, new copy]
│   ├── headline (font-serif)                  [REUSE style, per-screen copy]
│   ├── supporting copy                        [REUSE style]
│   └── ambient glow div                       [REUSE — exact Hero.tsx glow]
│
└── AuthCard                                   [NEW] the card/page content
    ├── MobileHeader (mobile only)              [NEW] back link + wordmark
    ├── AuthHeader                              [NEW] headline + subtext +
    │                                             switch-mode link
    │   └── (Login↔Register cross-link)
    │
    ├── LoginForm | RegisterForm |               [NEW — one per screen]
    │   ForgotPasswordForm | ResetPasswordForm    each wraps ONE existing
    │   │                                          Server Action (already
    │   │                                          built, see architecture
    │   │                                          plan §1.1)
    │   ├── EmailInput                            [NEW] wraps FormField
    │   │                                          [REUSE — FormField, with
    │   │                                           additive `tone` prop for
    │   │                                           brand-red error styling]
    │   ├── PasswordInput                         [NEW] wraps FormField +
    │   │                                          Eye/EyeOff toggle
    │   ├── inline field hint / error              [REUSE — FormField's
    │   │                                          existing hint/errors props]
    │   ├── AuthButton (primary CTA variant)        [NEW variant of the
    │   │                                          existing Button — same
    │   │                                          component, new `rj`
    │   │                                          variant added to
    │   │                                          buttonVariants(), not a
    │   │                                          parallel component]
    │   └── form-level error banner                [REUSE — ErrorState,
    │                                              unchanged]
    │
    ├── VerificationPending                       [NEW] §4 success substate
    ├── AuthSuccessState                          [NEW] shared by §5/§6
    │                                              success + §6's expired
    │                                              guard (icon + tone prop)
    └── AuthFooter                                [NEW] legal microcopy /
                                                   back-links, content varies
                                                   per screen via props
```

**Reusability legend applied above:**
- **`[REUSE]`** — the exact existing component/style, zero changes.
- **`[NEW]`** — genuinely new, but composed from reused primitives/tokens.
- No component on this tree duplicates an existing one's responsibility —
  `AuthSuccessState` in particular is written once and parameterized (icon,
  tone, headline, body, action) so §4's email-sent state, §5's inbox-check
  state, and §6's password-updated state don't become three near-identical
  components.
- **Branding reuse:** the landing's `Logo` was extracted from the private
  `LandingNavbar` markup into a shared `src/components/brand/Wordmark.tsx`
  so `(marketing)`, `(auth)`, and future dashboards all render one component
  — no duplicated markup anywhere. This is the one extraction the auth module
  requires; everything else in `[REUSE]` is used as-is.
- **`FormField` reuse with a single additive prop:** auth forms pass an
  optional `tone` so field errors/borders render in the brand red family
  (see the §1 AA note); default `FormField` behavior and every existing
  `(shop)` caller are untouched.

---

## 8. Responsive behavior summary

| Aspect | Mobile (`<768px`, base) | Tablet (`768–1023px`, `md:`) | Desktop (`≥1024px`, `lg:`) |
| --- | --- | --- | --- |
| Layout | Single column, no card chrome | Centered card on `rj-gray-50` | Split panel (editorial + card) |
| Card | None (page IS the card) | `rounded-3xl shadow-xl border` | `rounded-3xl` (right panel, shadow optional — black panel already provides contrast) |
| Card width | `100%`, `px-6` page gutter | `max-w-[440px]` | `max-w-[440px]`, right panel `px-8` |
| Headline size | `text-[28px]` | `text-[32px]` | `text-[clamp(2.5rem,5vw,4rem)]` (left panel only) + `text-[32px]` (card) |
| Editorial panel | Hidden | Hidden | Visible, `lg:flex`, ~45% width |
| Back navigation | Explicit `← Back` link | Implicit (browser back / footer link) | Implicit (wordmark → home) |
| Field spacing | `gap-4` between fields | `gap-5` | `gap-5` |
| Button | Full-width always | Full-width (card-constrained) | Full-width (card-constrained) |

Breakpoints are Tailwind defaults already in use project-wide (`md: 768px`
in most landing components, `lg: 1024px` for the split points like
`ProductCategories`' bento grid) — no custom breakpoints introduced.

---

## 9. Loading, error, empty, and success states

| Screen | Loading | Error | Empty | Success |
| --- | --- | --- | --- | --- |
| **Login** | `AuthButton isLoading` — spinner replaces label, button + both fields `disabled`, `aria-busy="true"` | `ErrorState` banner above the form: *"Invalid email or password."* (generic — no enumeration) | N/A (form always has content) | `router.replace(redirectTo ?? "/")` — no visible success screen, immediate navigation is the confirmation |
| **Register** | Same button pattern | `ErrorState`: *"That email is already registered."* or generic failure copy; field-level errors via `FormField` (e.g. password too short) shown inline, not just banner | N/A | `VerificationPending` substate (§4) |
| **Forgot Password** | Same button pattern | Only for genuine failures (network/server) — **never** "email not found" (§9 of architecture plan) | N/A | `AuthSuccessState` "Check Your Inbox" (§5) |
| **Reset Password** | Same button pattern | Field-level (password mismatch) inline; session-guard "Link Has Expired" state (§6.B) is a **distinct empty/blocked state**, not a transient error | **This screen's "empty" state** = no active recovery session → the expired-link guard IS the empty state, deliberately designed as its own screen rather than a generic error banner, since the user needs a different next action (request a new link) than "try again" | `AuthSuccessState` "Password Updated" (§6) |
| **Email Verification** (Register substate) | "Resend email" button gets its own `isLoading` + a **cooldown** state after success (disabled, label counts down) — a third loading variant beyond the shared pattern, documented here explicitly | Resend failure → small inline `text-rj-red-dark` message under the button, not a full `ErrorState` (low-severity, non-blocking action) | N/A | Resend success → button label flashes "Sent!" briefly (reusing the `pop` keyframe at small scale) before returning to the cooldown countdown |

### 9.1 Error message policy — no raw Supabase strings ever reach the UI

The existing actions return `ActionResult<T>` with a plain `error` string. To
close the one real gap found in the audit (login/reset currently surfaced
Supabase's `error.message` verbatim — e.g. `"Email not confirmed"`, which leaks
account state), every action's catch routes through a single server-side
mapper, **`mapAuthError(error)`**, living in `features/auth/constants`. It is
called in each action's `catch`, so the client contract and `ActionResult`
shape are unchanged:

| Supabase input (message/code) | Friendly copy rendered |
| --- | --- |
| `Invalid login credentials` | "Invalid email or password." |
| `Email not confirmed` / `unverified` | "Please verify your email address. We sent a link to your inbox." (with a resend affordance) |
| `User already registered` | "An account with this email already exists. Try signing in." |
| `Email rate limit exceeded` / 429 | "Too many attempts. Please try again later." |
| `Network`/`fetch`/`server` errors | "Something went wrong. Please try again." |
| anything else | "Something went wrong. Please try again." (never the raw message) |

This preserves the server-action architecture (no client changes) and
guarantees **no user enumeration** on every screen, matching the
architecture plan's security checklist. Forgot-password already returns a
generic success unconditionally and keeps doing so.

---

## 10. Accessibility (WCAG 2.2 AA) checklist

| Requirement | WCAG SC | Implementation |
| --- | --- | --- |
| Text contrast | 1.4.3 | Verified pairs: `rj-black`/`rj-white` ≈18:1; hint & legal text `rj-gray-600` on `rj-white` ≈5.0:1 ✓; small red text (links, eyebrows, emphasis) `rj-red-dark` on `rj-white` ≈5.5:1 ✓; CTA label (white on `rj-red`) ≈4.56:1 ✓; light eyebrow on the black panel ✓. Plain `rj-red` on `rj-white` ≈4.26:1 is used **only** for large text, icons, and non-text — never for small text |
| Non-text contrast (input borders, icons) | 1.4.11 | Resting input border is `border-rj-gray-600` (#6b6b6b) on white ≈5.0:1 — passes the 3:1 requirement (the pre-audit `rj-gray-200` ≈1.4:1 claim was wrong and is removed). Focus ring (`ring-rj-red/30` + `border-rj-red`) strengthens contrast further on focus. Icons are decorative (`aria-hidden`), so no 3:1 burden |
| Keyboard operability | 2.1.1 | Every interactive element is a native `<button>`, `<a>`, or `<input>` — no click-only `<div>` handlers anywhere in this spec |
| No keyboard trap | 2.1.2 | N/A concern — no modal, no custom widget that could trap focus (dedicated pages per the architecture decision) |
| Focus order | 2.4.3 | DOM order matches visual order top-to-bottom in every wireframe above; password-toggle button sits *after* the input in tab order, not before |
| Focus management on state changes | 2.4.3 / 4.1.3 | Every in-place form→state swap moves focus to the new heading (`tabIndex={-1}`) per §10.1 — no dropped focus, no trapped focus |
| Link purpose in context | 2.4.4 | "Forgot password?", "Create an account", "Back to Sign In" are all self-descriptive without needing surrounding text |
| Visible focus indicator | 2.4.7 | `focus-visible:ring-2` convention (already on `Button`/`FormField`) carried into the new `AuthButton` variant and `EmailInput`/`PasswordInput` — not omitted for visual cleanliness |
| No timing-based redirects | 2.2.1 | §6's "Password Updated" success uses an explicit "Continue" button, not an auto-redirect timer |
| Error identification | 3.3.1 | `FormField` already sets `aria-invalid` + `role="alert"` on field errors — reused unchanged |
| Labels/instructions | 3.3.2 | Every field has a visible `<label>` (via `FormField`), not placeholder-only labeling (placeholders disappear on input — real labels don't) |
| Error suggestion | 3.3.3 | Password hint ("must be at least 8 characters") shown proactively, not only after failure |
| Status messages | 4.1.3 | Success/status screens (`VerificationPending`, `AuthSuccessState`) render with `role="status"` + `aria-live="polite"`; errors and the expired guard render with `role="alert"` (interruptive, matching `ErrorState`). See §10.1 for the focus hand-off |
| Touch target size | 2.5.8 | Password-visibility toggle sized to `h-11 w-11` (44px) hit area even though the icon itself renders at 16px — icon-only buttons elsewhere in the landing (`LandingNavbar` search/cart) already follow this `h-8 w-8`–`h-10 w-10` pattern; auth's toggle uses the larger end of that range since it sits inside a denser form context |
| Reduced motion | 2.3.3 | The global `prefers-reduced-motion` override already in `globals.css` (added during the landing phase) automatically suppresses `fadeSlideIn`/`pop` here too — no auth-specific override needed |
| Autocomplete attributes | 1.3.5 | `autoComplete="email"`, `"current-password"`, `"new-password"`, `"name"` set per field, per HTML spec tokens — helps password managers and reduces re-entry, a direct WCAG success criterion |

### 10.1 Focus management on in-place transitions

When a form is replaced in place by a state screen — Register's
`VerificationPending`, Forgot Password's `AuthSuccessState` ("Check Your
Inbox"), Reset Password's success or expired-guard — the swap is orchestrated
by a small imperative handler in `AuthCard` (a ref + `useEffect`, no
navigation):

- **Move focus** to the new screen's heading (`<h2 tabIndex={-1}>`, then
  `.focus()`), satisfying WCAG 2.4.3 focus order and ensuring the new state is
  read out — the user is never left with focus on a removed form node.
- **Role / live region:** success/status screens (`VerificationPending`,
  `AuthSuccessState`) render with `role="status"` + `aria-live="polite"`; the
  expired-link guard renders with `role="alert"` (interruptive, matching
  `ErrorState`).
- **Resend countdown:** the "Resend in 27s" label lives inside the same
  polite live region so screen readers hear the countdown update without an
  interruptive `alert`.
- **No timed redirect anywhere:** this replaces the earlier "auto-redirect
  after delay" idea entirely — §6's success uses an explicit "Continue"
  button (WCAG 2.2.1).

---

## 11. Design consistency checklist — Landing vs. Auth

| Design element | Landing Page | Authentication Pages | Match |
| --- | --- | --- | --- |
| Display typeface | DM Serif Display | DM Serif Display | ✅ identical |
| Body typeface | DM Sans | DM Sans | ✅ identical |
| Brand accent color | `rj-red #E8192C` (hover `#C8111E`) | Same tokens; small red *text* uses `rj-red-dark` for AA (§1) | ✅ identical palette + documented AA-safe usage |
| Ink/paper pair | `rj-black` / `rj-white` | `rj-black` / `rj-white` | ✅ identical |
| Eyebrow label style | `text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red` | Same classes; AA-safe color swaps: `text-rj-red-dark` on light, `text-rj-gray-200` on the black panel (§1) | ✅ identical, with documented color swaps |
| Primary button | Pill, `bg-rj-red`, `shadow-rj-red/25`, `active:scale-95` | Same classes, `w-full` added | ✅ identical (width is the only diff, and it's contextual) |
| Outline button | Pill, `border-rj-black`, invert-on-hover | Reused for "Request New Link" secondary actions where applicable | ✅ identical |
| Card radius (hero-weight) | `rounded-3xl` (Hero card, chat container) | `rounded-3xl` (AuthCard) | ✅ identical |
| Section background rhythm | Alternates `rj-white` / `rj-black` / `rj-gray-50` | Desktop alternates `rj-black` (panel) / `rj-white` (card); tablet uses `rj-gray-50` | ✅ same palette, same alternation logic |
| Spacing | 4px/8px rhythm — CTA `px-7 py-3.5`, sections `py-24`, cards `p-8`, field `gap-4/5` | Same classes lifted verbatim | ✅ identical (no new grid) |
| Icon library | `lucide-react` | `lucide-react` | ✅ identical, no new icon set introduced |
| Entrance animation | `fadeSlideIn` keyframe | Same keyframe, reused on card content | ✅ identical |
| Micro-interaction (badges/success) | `pop` keyframe (cart badge) | Reused for success icons | ✅ identical |
| Reduced-motion handling | Global override in `globals.css` | Same global override, no auth-specific CSS needed | ✅ identical |
| Text input shape | N/A (only a pill search box exists) | `rounded-xl` (landing tile radius) + `border-rj-gray-600` (AA, §1) | ⚠️ **new context, justified in §1** — a landing radius extended to a new element type; resting border reuses an existing token |
| Max content width | `max-w-7xl` (sections) | `max-w-[440px]` (card) | ⚠️ **intentionally different** — auth is a focused single-task surface, not a browsing surface; matching `max-w-7xl` would produce an absurdly wide login form, so this divergence is a UX requirement, not an inconsistency |

Every row above is traceable to a real landing source file. The only values
that differ from the landing's literal usage are: (a) the `rounded-xl` input
shape (a landing radius extended to a new element type), (b) the
`border-rj-gray-600` resting border (an existing token chosen to meet 1.4.11),
and (c) the two AA-safe color swaps on small red text (`rj-red-dark`) and the
dark-panel eyebrow (`rj-gray-200`). All are documented in §1 with a reason —
none is an unexplained gap.

---

## 12. Design-to-Figma verification (vs. the approved Landing Page system)

Pre-freeze check that the auth surface is pixel-consistent with the approved
Landing Page/Figma system, axis by axis. "Evidence" names the real source
each value is lifted from; nothing here is asserted from memory.

| Axis | Auth value | Evidence (landing source) | Match |
| --- | --- | --- | --- |
| Colors | `rj-*` tokens only — black/white/red/red-dark/gray-50…800/green | `src/app/globals.css` `@theme inline`; identical hex | ✅ exact |
| Typography hierarchy | Serif display (DM Serif Display 400) for headlines; sans (DM Sans) body; `text-[10px]` uppercase `tracking-[0.3em]` eyebrow | `src/app/layout.tsx` fonts; every section kicker | ✅ identical |
| Spacing | Landing classes reused verbatim — CTA `px-7 py-3.5`, outline `py-2`, card `p-8`, fields `gap-4/5`, sections `py-24` | `Hero.tsx`, `FeaturedShops.tsx`, section paddings | ✅ same rhythm (4px base, 8px section rhythm — inherited, no new grid) |
| Button variants | Primary = hero "Shop Now" classes + `w-full`; Outline = "Visit Shop" classes; both as `rj` variants of the shared `Button` | `Hero.tsx`, `FeaturedShops.tsx` | ✅ reused |
| Form controls | `FormField` reused (label/error/hint contract) with one additive `tone` prop; new `rounded-xl` input = landing tile radius; `border-rj-gray-600` (AA) | `components/forms/FormField.tsx`; `FeaturedProductsGrid.tsx` tile radius | ✅ one design language |
| Shadows & border radius | `rounded-3xl` + `shadow-2xl` (desktop); `rounded-3xl` + `shadow-xl` + `border-rj-gray-100` (tablet card); `shadow-sm → xl` hover | `Hero.tsx`, `SmartAssistantPreview.tsx`, `FeaturedShops.tsx` | ✅ identical |
| Icons | `lucide-react` (Mail, Lock, Eye/EyeOff, ArrowLeft, check/alert) | same library throughout landing | ✅ same icon set |
| Animations | `fadeSlideIn 0.7s ease both` entrance; `pop` for success icons/counters; global reduced-motion override | `Hero.tsx`, `LandingNavbar.tsx`, `globals.css` | ✅ same motion principles |
| Responsive breakpoints | Mobile base (<768), Tablet `md:` (768–1023), Desktop `lg:` (≥1024) — the exact Tailwind tokens the landing already uses | landing components (`md:px-8`, `md:col-span-2` bento), `globals.css` | ✅ no custom breakpoints |
| Reusable components | Only `AuthLayout`/`AuthCard`/`EmailInput`/`PasswordInput`/state shells are new; `FormField`, `ErrorState`, `Button`, `Wordmark`, `ActionResult` reused; no duplicate UI | throughout | ✅ verified |
| AA-safe color usage | Small red text → `rj-red-dark`; dark-panel eyebrow → `rj-gray-200`; hint/legal → `rj-gray-600` | existing tokens only (§1 AA note) | ✅ no new tokens |

**Result:** auth introduces no new visual language — it is the landing system
recomposed for a single-task surface. The only value with no literal landing
precedent is the `rounded-xl` input shape and its `border-rj-gray-600` rest
border, both justified in §1.

---

## 13. Verification, QA gate & design freeze

### 13.1 QA gate (replaces the "already tested" assumption)

The auth back end (actions, schemas, queries, PKCE callback, `proxy.ts`) is
wired and type-checks today, but this repository ships **no test runner or
test files yet** — the earlier architecture plan's "tested" wording was not
accurate and is superseded here. Before the implementation phase is accepted,
the following must pass:

- `npm run lint` — zero errors.
- `npm run typecheck` — zero errors.
- `npm run build` — production build succeeds.
- **Planned unit tests** (added during implementation, tracked in the QA
  phase of the architecture roadmap):
  - each Zod schema: accept/reject cases + exact error paths, including
    `resetPasswordSchema`'s confirm-password `.refine`;
  - `mapAuthError()`: every input string/code in §9.1 → its friendly copy,
    plus the unknown-error fallback;
  - each action returns the `ActionResult` contract (`ok`/`fail`/`fieldErrors`).

### 13.2 Final re-audit confirmation (this revision)

1. **No remaining Critical issues** from the pre-implementation audit — the
   three Critical fixes are applied: hint/legal text contrast (§1/§4/§6),
   resting input border (§1), and error normalization (§9.1), plus the
   additional AA fix for small red text (§1).
2. **WCAG 2.2 AA compliance** — verified pairs: `rj-gray-600` on white
   ≈5.0:1 (text ≥4.5:1 ✓, border ≥3:1 ✓); small red text `rj-red-dark` on
   white ≈5.5:1 ✓; CTA label white-on-`rj-red` ≈4.56:1 ✓; light eyebrow on
   the black panel ✓; `rj-black`/`rj-white` ≈18:1 ✓; focus management + live
   regions per §10.1.
3. **100% consistency with the Landing Page design system** — §12 table
   matches on every axis; the three documented deviations are traceable to
   landing values.
4. **Compatible with the existing stack** — Next.js 16 (`src/proxy.ts`),
   Server Actions + `useActionState`, Zod schemas, Tailwind v4 + shadcn/ui
   (`cva`/`Button`/`FormField`/`ErrorState`), Supabase Auth (PKCE callback),
   and middleware/proxy route protection — all reused as-is.
5. **No database schema or authentication-architecture changes** — this
   module is UI that calls already-built actions/queries.

### 13.3 Design freeze

With all checks passing, this document is locked as **Version 1.0 (Design
Freeze)**. Implementation must follow it exactly. Future changes require one
of: a confirmed bug, a WCAG/a11y defect, or an approved scope change — each
tracked as a versioned amendment to this document *before* code changes.

---

## 14. What this spec does not cover (by design)

Per the approved architecture plan's scope boundaries (§13 of that
document): no social/OAuth buttons, no profile-field capture at
registration (avatar/username/phone/bio), no seller-upgrade UI, no
"guest checkout" prompt modal. If any of these are wanted, they need
separate design passes — this spec intentionally stays inside the five
screens requested.
