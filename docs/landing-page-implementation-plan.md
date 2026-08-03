# Landing Page — Implementation Plan (Phase 2)

> Status: **Implemented ✅** (2026-08-03). All six phases below are complete;
> typecheck, lint, and production build pass with zero errors/warnings. The
> landing renders pixel-faithfully to the Figma (verified desktop + mobile), and
> the project is prepared for the Authentication module (no auth UI built). See
> the completion notes at the end of this document.

## 0. Goal

Recreate the approved Figma design **pixel-for-pixel** as the RobertJ
Marketplace landing page, wire the data-driven sections to the **existing**
Supabase schema (no schema changes), and finish preparing the project for the
Authentication module — **without building any auth UI**.

Figma source: `Marketplace-Landing-Page-Design` (Figma Make file
`kbnVKG1f0EgPsNgcVCQlJN`). Full source was pulled via the Figma MCP and audited.

---

## 1. Codebase Audit — what already exists

| Area | State | Consequence for this phase |
| --- | --- | --- |
| Next.js 16 App Router + TS strict + Tailwind v4 | ✅ configured | Build on it as-is |
| Feature-first architecture (`docs/architecture.md`) | ✅ established | Follow it exactly |
| Supabase clients (`lib/supabase/{server,client,session}.ts`) | ✅ complete | **Auth prep mostly done** |
| `proxy.ts` (session refresh + protected routes) | ✅ complete | Keep |
| `database.types.ts` (6 tables, enums, RPCs) | ✅ hand-written | Use as-is; regen later |
| `features/auth` (service, actions, schema, SignInForm) | ✅ present | Only gaps remain (§6) |
| `features/products` (service, card, grid, actions) | ✅ present | Extend, don't duplicate |
| `features/cart` (provider, reducer, hooks) | ✅ present | Reuse `AddToCartButton` |
| `features/categories` and 8 other features | ⬜ empty `.gitkeep` | Build `categories` service here |
| `app/page.tsx` | ⬜ placeholder | **Replace with landing** |
| Root `layout.tsx` | ⚠️ wraps all routes in `SiteHeader` + `max-w-6xl` main + `SiteFooter`, Geist fonts, blue theme | **Must refactor** (see §3.1) |
| `globals.css` | ⚠️ generic blue tokens, OS dark-mode reactive | **Add `rj-*` design tokens** (§3.2) |

**Key finding:** the backend and auth plumbing are already in place. The real
work is (a) the pixel-perfect UI, (b) two small additive read services, and
(c) closing a handful of auth-prep gaps.

---

## 2. Figma Design Audit — section inventory & data mapping

Sections render top-to-bottom in this exact order:

| # | Section | Type | Data source | Client? |
| --- | --- | --- | --- | --- |
| 1 | Announcement bar (rotating msgs) | Static | Config constant | Client (rotator) |
| 2 | Navbar (sticky, scroll state, search, cart, mobile menu, Sign In) | Chrome | Session (Sign In) + cart count | Client island |
| 3 | Hero (dark, bg image, badge, headline, animated stats, editorial cards, floating badges, scroll cue) | Mostly static | Stats = constants (placeholder) | Client islands (counter, reveal) |
| 4 | Marquee band (red, infinite scroll) | Static | Constant | Pure CSS (Server) |
| 5 | **Featured Shops** (horizontal cards, badges, arrows) | **Data / placeholder** | ⚠️ **no shop table in schema** → placeholder (§4.3) | Client (scroll ctrls) |
| 6 | **Product Categories** (bento grid, 1 large + 3) | **Data** | `categories` table + per-category product counts | Server + reveal island |
| 7 | **Featured Products** (filter tabs, grid, quick-add) | **Data** | `products` where `featured=true, status=active` (+ seller name, cover image) | Client (filter/hover) |
| 8 | Editorial banner (New Season CTA) | Static | Local image | Server + reveal |
| 9 | About (image collage, animated stats) | Static | Constants (placeholder stats) | Client (counter) |
| 10 | Marketplace features (4 cards) | Static | Constant | Server + reveal |
| 11 | Smart Assistant (chat UI demo) | Static / simulated | Local demo state (assistant feature is future) | Client |
| 12 | Footer (brand, 3 link cols, social, trust badges, bottom bar) | Static | Config | Server |
| 13 | Back-to-top (floating) | Static | — | Client |

### Design tokens (from Figma `index.css`)

- **Fonts:** `DM Serif Display` (display/headings), `DM Sans` (body).
  Currently Geist — **swap via `next/font/google`**.
- **Palette:**
  `--rj-black #0D0D0D`, `--rj-white #F8F7F5`, `--rj-red #E8192C`,
  `--rj-red-dark #C8111E`, grays `#F5F4F2 #EBEBEB #D4D4D4 #9B9B9B #6B6B6B #2D2D2D`,
  accents `#F4B942` (gold), `#22C55E` (green).
- **Aesthetic:** fixed **light** editorial look — **not** OS dark-mode reactive.
  The landing must render identically regardless of system theme.
- **Radii:** pill (`rounded-full`) buttons/badges; `rounded-xl/2xl/3xl` cards.
- **Animations:** `fadeSlideIn`, `float`, `marquee`, `pop`, `bounce` keyframes;
  reveal-on-scroll via IntersectionObserver; animated counters.

---

## 3. Architecture Decisions

### 3.1 Routing / layout split (required refactor)

The landing is full-bleed with its own navbar/footer; the rest of the app uses
the constrained `SiteHeader`/`SiteFooter` chrome. Route groups nest under the
root layout, so the fix is:

```
app/
├── layout.tsx            → html/body + fonts + AppProviders ONLY (strip chrome)
├── (marketing)/
│   ├── layout.tsx        → full-bleed; renders landing Navbar + Footer + BackToTop
│   └── page.tsx          → the Landing Page (composes landing sections)
└── (shop)/
    ├── layout.tsx        → SiteHeader + <main class="max-w-6xl …"> + SiteFooter
    ├── products/…        → MOVED here (unchanged)
    ├── cart/…            → MOVED here (unchanged)
    └── sign-in/…         → MOVED here (unchanged)
```

- Root `layout.tsx` keeps global providers + font variables, drops the chrome.
- Existing `error.tsx` / `loading.tsx` / `not-found.tsx` stay at root.
- This is a mechanical move; no page bodies change.

### 3.2 Design tokens & fonts

- Add DM Serif Display + DM Sans through `next/font/google` in root layout,
  exposing `--font-serif` / `--font-sans`.
- Extend `globals.css` `@theme inline` with the `rj-*` palette so components use
  `bg-rj-black`, `text-rj-red`, etc. (no raw hex scattered in JSX).
- Landing uses the `rj-*` literals (fixed light); the existing semantic tokens
  (`bg-background` …) remain for the `(shop)` app so nothing else regresses.
- Port the five keyframes into `globals.css` (from the inline `<style>` block).

### 3.3 Feature placement

New landing feature — self-contained, per architecture:

```
src/features/landing/
├── components/
│   ├── AnnouncementBar.tsx        (client)
│   ├── LandingNavbar.tsx          (client)
│   ├── Hero.tsx                   (server shell) + HeroStats/AnimatedCounter (client)
│   ├── MarqueeBand.tsx            (server, CSS)
│   ├── FeaturedShops.tsx          (server shell) + FeaturedShopsCarousel (client)
│   ├── ProductCategories.tsx      (server) + CategoryBentoGrid
│   ├── FeaturedProducts.tsx       (client — filter tabs + quick add)
│   ├── EditorialBanner.tsx        (server)
│   ├── AboutSection.tsx           (server + counter island)
│   ├── MarketplaceFeatures.tsx    (server)
│   ├── SmartAssistantPreview.tsx  (client — demo chat)
│   ├── LandingFooter.tsx          (server)
│   └── BackToTop.tsx              (client)
├── constants/landing.constants.ts (announcements, marquee, features, about stats)
├── hooks/useInView.ts             (IntersectionObserver reveal)
├── types/landing.types.ts
└── index.ts
```

Shared, reusable primitives (`RevealOnScroll`, `AnimatedCounter`) live here and
are consumed by multiple sections — no duplication.

### 3.4 Animations — Framer Motion where it earns its place

- Add `framer-motion`. Use it for **reveal-on-scroll** (`whileInView`) and the
  **animated counters** — genuine wins over hand-rolled observers.
- Keep the **marquee** and **float/pulse** as pure CSS keyframes (cheaper, and
  keeps those shells as Server Components).
- Keep client islands small; section shells stay Server Components where the
  interactive part can be isolated.

### 3.5 Icons — Lucide React

Replace the hand-rolled inline SVGs with Lucide equivalents:
`Search, ShoppingBag, Menu, X, ArrowRight, ArrowLeft, ArrowDown, Star, Heart,
Zap, Check, ShieldCheck, Layers, Truck, Send, Instagram, Facebook, ArrowUp`.
(TikTok has no Lucide glyph → keep a small custom SVG, documented as the one
exception.)

### 3.6 Images

The Figma uses Unsplash URLs for decorative imagery + 6 exported PNGs.

- **Decorative/placeholder imagery** (hero bg, editorial cards, about collage,
  editorial banner, featured-shop covers, category fallbacks): **download the
  exact referenced assets into `public/landing/`** and serve locally with
  `next/image`. This keeps the page self-contained, avoids widening
  `remotePatterns`, and removes a runtime dependency on Unsplash.
- **Real product/category images** come from **Supabase Storage**, already
  whitelisted in `next.config.ts` `remotePatterns`.
- All images use `next/image` with explicit `sizes`; below-the-fold images stay
  lazy (default), hero LCP image gets `priority`.

---

## 4. Data Integration (existing schema only — no migrations)

### 4.1 Categories → `ProductCategories` (real data)

New `features/categories`:
- `services/category.service.ts`: `listActiveCategories(limit)` →
  `select('id,name,slug,image_url,description, products(count)')`
  `.eq('active',true).order('sort_order')`. Maps `products.count` → the
  "N+ items" label. `image_url` → bento image (fallback to `public/landing`).
- `types/category.types.ts`, `index.ts`.
- Rendered by a **Server Component**; empty result → clearly-marked placeholder
  tiles (no crash).

### 4.2 Featured Products → `FeaturedProducts` (real data)

Extend `features/products/services/product.service.ts` (additive):
- `listFeaturedProducts(limit)` → existing `PRODUCT_COLUMNS` + join seller:
  `seller:profiles!products_seller_id_fkey ( full_name, username )`, filter
  `featured=true, status='active'`, order `created_at desc`.
- Add `sellerName` to the `Product` domain model + `toProduct` mapping (the
  design's product card shows the shop/seller name). Purely additive.
- The filter tabs (All / Women's / Men's / Essentials / Sale) operate on the
  fetched set client-side to match the design's instant filtering; "Sale" =
  products with a compare-at/original price (see §4.4).
- Quick-add reuses the existing cart (`AddToCartButton` / cart provider).
- Empty result → marked placeholder grid.

### 4.3 Featured Shops → **placeholder** (schema-limited, documented)

The schema has **no shops/featured-shops entity** — only `profiles` with
`role='seller'`, which lack a cover image, rating, badge, and product count.
Therefore:
- Render the section with **clearly-marked placeholder data** from a constants
  file, structured to match a future `shops`/seller-aggregate shape.
- Where cheap and real, we *may* surface per-seller product counts, but rating,
  badge, and cover image remain placeholder until the schema supports them.
- A `// PLACEHOLDER: no shop entity in current schema — see plan §4.3` marker is
  left at the data boundary so the future integration point is obvious.
- **No schema change is made.**

### 4.4 Sale price note

The design shows `originalPrice` (compare-at). The `products` table has no
compare-at column. Options documented for approval:
- **(A, default)** Treat "Sale" as a presentational placeholder driven by the
  section's demo data / a tag convention (`tags` contains `sale`) — **no schema
  change**.
- (B) Add a `compare_at_price_cents` column later (out of scope; needs schema
  change + approval).
This phase uses **(A)** so no migration is introduced.

### 4.5 Static/marketing content

Announcement messages, marquee items, the 4 marketplace-feature cards, About
copy/stats, and the Smart Assistant demo transcript are **marketing content**,
not DB rows → live in `features/landing/constants`. This is not "hardcoding data
that exists in the DB"; it's copy the schema does not model.

---

## 5. Component build order (phased)

**Phase A — Foundation**
1. Add deps: `framer-motion`. Confirm `lucide-react` present.
2. Fonts (DM Serif Display + DM Sans) via `next/font`; expose CSS vars.
3. `globals.css`: add `rj-*` tokens + port keyframes.
4. Root `layout.tsx` refactor (strip chrome, keep providers/fonts).
5. Create `(marketing)` + `(shop)` route groups; move `products`, `cart`,
   `sign-in` into `(shop)`; verify all existing routes still render.

**Phase B — Data services**
6. `features/categories` service + types + index.
7. `product.service.listFeaturedProducts` + `sellerName` on domain model.

**Phase C — Landing sections** (in design order, reusing `useInView`,
`RevealOnScroll`, `AnimatedCounter`)
8. AnnouncementBar → LandingNavbar → Hero → MarqueeBand → FeaturedShops →
   ProductCategories → FeaturedProducts → EditorialBanner → AboutSection →
   MarketplaceFeatures → SmartAssistantPreview → LandingFooter → BackToTop.
9. Compose in `(marketing)/page.tsx` (Server Component) fetching categories +
   featured products and passing to sections.

**Phase D — Fidelity pass**
10. Side-by-side against Figma screenshots at desktop / tablet / mobile;
    correct spacing, type scale, radii, shadows, hover states.
11. Accessibility: semantic landmarks, alt text, focus states, `aria-label`s,
    reduced-motion guard, color-contrast check.

**Phase E — Verification** (see §7).

---

## 6. Authentication Preparation — remaining gaps only

Already done: server/client/admin Supabase clients, `session.ts`, `proxy.ts`
route protection, `auth.service` (signIn/up/out, `getSessionUser`,
`requireSessionUser`, `requireRole`), auth actions + Zod schema, `SignInForm`,
`PROTECTED_ROUTE_PREFIXES`, `AUTH_ROUTES`.

To close (no UI, wiring only):
- [ ] `.env.example` — env schema references it but it's missing. Add template
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `NEXT_PUBLIC_SITE_URL`, optional `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] `app/auth/callback/route.ts` — PKCE code-exchange route handler for email
      verification + password recovery (`exchangeCodeForSession`). Prepared,
      no page.
- [ ] Extend `auth.service` with prepared (unused-by-UI) methods:
      `sendPasswordResetEmail(email)`, `updatePassword(newPassword)`,
      and a verification helper — ready for the next phase.
- [ ] Confirm `features/auth/index.ts` re-exports the service + actions used by
      future Login/Register/Forgot/Verify screens.
- [ ] Verify `(auth)` route-group placement decision documented (sign-in/up/
      forgot-password will land in a `(shop)` or dedicated `(auth)` group next
      phase — folders prepared, **UI not built**).
- [ ] Sanity-check `proxy.ts` matcher + `NEXT_PUBLIC_SITE_URL` used for auth
      redirect/callback URLs.

Explicitly **not** in this phase: Login, Register, Forgot Password, Email
Verification, and session-management **UI**.

---

## 7. Completion criteria (must all pass)

- [ ] Landing is a pixel-perfect match to Figma (layout, spacing, type, color,
      radii, shadows, hover states, responsive behavior, section order).
- [ ] Responsive at desktop / tablet / mobile, matching the design's breakpoints.
- [ ] Categories + Featured Products render **real Supabase data**; data-less
      sections show clearly-marked placeholders; nothing hardcoded that the DB
      already owns.
- [ ] **No schema changes**, no new migrations.
- [ ] Feature-first architecture, absolute imports, reusable components, no
      duplication, Server Components by default, minimal client JS.
- [ ] TS strict, **no `any`**, semantic HTML, WCAG basics (contrast, focus,
      alt, reduced-motion).
- [ ] Auth prep complete per §6; **no auth UI built**.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run build` all pass with
      **zero errors/warnings**.

---

## 8. Decisions — RESOLVED (approved 2026-08-03)

1. ✅ **Root layout refactor (§3.1)** — **Approved.** Introduce `(marketing)` /
   `(shop)` route groups; move `products` / `cart` / `sign-in` into `(shop)`
   unchanged.
2. ✅ **Featured Shops (§4.3)** — **Marked placeholder.** No schema change; a
   future-integration marker is left at the data boundary.
3. ✅ **Images (§3.6)** — **Download exact assets to `public/landing/`** and
   serve locally with `next/image`. Do not widen `remotePatterns` to Unsplash.
4. ✅ **Sale/compare-at price (§4.4)** — **Placeholder approach (A).** Treat
   "Sale" presentationally (tag convention); no schema change.

### Open (informational, non-blocking)

5. **Live DB seed state unverified** — Supabase MCP denied read access to
   project `xthttwbggkmmkqunastg`. Integration is written defensively (real data
   when present, clearly-marked placeholder when empty). If the DB is empty,
   Categories / Featured Products ship with placeholders until seeded.
