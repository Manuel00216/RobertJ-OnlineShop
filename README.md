# Roberj Marketplace

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Supabase, built on a
feature-first architecture with a shared component layer.

## Getting started

1. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   The app validates these at startup and fails fast if they are missing.

2. Run the dev server:

   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

The full map — folder responsibilities, data flow, feature anatomy, and
extension notes — lives in [`docs/architecture.md`](docs/architecture.md).

Short version:

- `src/app` — routes only; pages compose features and never touch the database.
- `src/components` — reusable, business-agnostic UI.
- `src/features` — self-contained business domains, each with its own
  `components / hooks / services / schemas / types / utils / actions`.
- `src/lib` — Supabase clients, validation primitives, pure utilities.
- `src/constants`, `src/config`, `src/types` — no hardcoded routes, roles,
  statuses, or env access anywhere else.

Data flow: **Page → Server Action → Service → Supabase → Database.**

## Database

Regenerate types after any schema change:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/database.types.ts
```

`src/lib/supabase/database.types.ts` currently holds a hand-written schema for
`profiles`, `categories`, `products`, `orders`, and `order_items` so the
service layer type-checks before the real project exists.
