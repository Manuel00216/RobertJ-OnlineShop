# Architecture

## Purpose

Roberj Marketplace is a multi-vendor storefront. The codebase follows a
**feature-first** architecture with a **shared component** layer: reusable,
business-agnostic UI lives in `src/components`, and everything that encodes
marketplace rules lives inside a feature folder.

## Folder structure

```
src/
├── app/            Routes only. Pages compose features; they never query the DB.
├── components/     Reusable, business-agnostic UI.
│   ├── ui/         Primitives: Button, Card, Badge, Skeleton.
│   ├── layout/     SiteHeader, SiteFooter, PageHeader.
│   ├── navigation/ MainNav, CartIndicator.
│   ├── forms/      FormField and other input wrappers.
│   ├── feedback/   LoadingState, ErrorState, EmptyState.
│   ├── tables/     Shared table primitives.
│   ├── charts/     Shared chart primitives.
│   └── common/     Cross-cutting helpers that fit no other bucket.
├── features/       Self-contained business domains (see below).
├── services/       Cross-feature service composition (feature-owned services
│                   live in features/{feature}/services).
├── hooks/          Reusable, feature-agnostic hooks.
├── providers/      Client-side context providers, mounted via AppProviders.
├── lib/            Framework glue and pure utilities.
│   ├── supabase/   Browser, server, and admin clients, session refresh, DB types.
│   ├── auth/       Pure permission predicates.
│   ├── validations/ Zod primitives shared by multiple features.
│   ├── cache/      Cache tag definitions.
│   └── utils/      cn, currency, date, format, result.
├── constants/      Routes, roles, statuses, pagination, query keys.
├── config/         Validated env + site configuration.
├── types/          Global types (ActionResult, pagination, session).
├── styles/         Global style assets beyond app/globals.css.
└── proxy.ts        Session refresh + route protection.
```

> **Note on `proxy.ts`.** The original spec named this file `middleware.ts`.
> Next.js 16 deprecated that convention in favour of `proxy.ts` (default
> export named `proxy`), so the file was renamed. Its responsibility is
> unchanged.

## Feature anatomy

Each feature is self-contained and exposes its public surface through
`index.ts`:

```
features/products/
├── components/   Business-specific UI (ProductCard, ProductGrid, …)
├── hooks/        Feature-scoped hooks
├── services/     Every Supabase call for this domain
├── schemas/      Zod schemas
├── types/        Domain models
├── utils/        Pure helpers
├── actions/      Server Actions ("use server")
└── index.ts      Public API
```

Implemented today: `auth`, `products`, `cart`. The remaining feature folders
(`categories`, `checkout`, `inventory`, `orders`, `dashboard`, `reports`,
`notifications`, `assistant`) are scaffolded and follow the same shape.

## Data flow

```
Page (Server Component)
  ↓
Server Action  (features/{feature}/actions)
  ↓
Service        (features/{feature}/services)
  ↓
Supabase client (lib/supabase/server)
  ↓
Database
```

Rules this enforces:

- Pages, layouts, and UI components never call Supabase directly.
- Services own all row → domain-model mapping, so no `snake_case` column names
  leak past the service boundary.
- Server Actions validate input with Zod and return an `ActionResult<T>`
  envelope, so the UI branches on `success` instead of catching exceptions.

## Auth

`proxy.ts` refreshes the Supabase session on every request and guards the
prefixes listed in `PROTECTED_ROUTE_PREFIXES`. `/cart` is intentionally
**not** in that list — it is a public, client-side guest cart (see State
management), so shoppers can build a cart without an account; the routes that
commit it (checkout, orders, notifications, dashboard, profile) are gated.
Server-side authorization is re-checked inside actions via
`requireSessionUser` / `requireRole` — the proxy is a redirect convenience,
not the security boundary. Row Level Security in Supabase is the final
enforcement layer.

## State management

- Local UI state → `useState`
- Cart (complex, client-owned) → `useReducer` + Context, persisted to
  `localStorage` (`features/cart`)
- Server state fetched from Client Components → TanStack Query, keys defined in
  `constants/query-keys.ts`
- Everything server-rendered → Server Components, no client cache needed

## Styling

Tailwind CSS v4 with design tokens declared as CSS variables in
`app/globals.css` and exposed to Tailwind through `@theme inline`. Components
reference semantic tokens (`bg-primary`, `text-muted-foreground`) rather than
raw palette values, so light/dark mode is handled in one place.

## Async UI contract

Every async surface renders four states: loading (`LoadingState` /
`ProductGridSkeleton`), error (`ErrorState`), empty (`EmptyState`), and
success. Route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` provide
the fallbacks.

## API usage

The only external API is Supabase. Clients:

| Client | Where | Notes |
| --- | --- | --- |
| `createSupabaseBrowserClient` | Client Components | anon key, RLS applies |
| `createSupabaseServerClient` | Server Components, Actions, Route Handlers | cookie-bound session |
| `createSupabaseAdminClient` | trusted server jobs | service role, bypasses RLS |
| `updateSupabaseSession` | `proxy.ts` | refreshes auth cookies |

Schema design, ERD, RLS model, and review notes live in
[`docs/database.md`](./database.md). The migration is
`supabase/migrations/20260802000100_initial_schema.sql`.

Regenerate `lib/supabase/database.types.ts` after any schema change:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Future extensions

- `checkout` — payment provider integration; orders must be created inside a
  Postgres transaction/RPC so stock decrements atomically.
- `inventory` — seller-scoped product table built on `components/tables`.
- `reports` — aggregate queries exposed as Postgres views, charted with
  `components/charts`.
- `notifications` — Supabase Realtime channel surfaced through a provider.
- `assistant` — AI shopping assistant; keep prompt construction in
  `features/assistant/services`, never in components.
