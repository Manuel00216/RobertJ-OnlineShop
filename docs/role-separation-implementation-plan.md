# Strict Role Separation — Implementation Plan (READ-ONLY / awaiting approval)

> **Status:** Planning only. No code, DB, migration, RLS, route, config, dependency, or UI changed by this document.
> **Basis:** the completed read-only Role Separation Audit (this session). Every gap (G1–G8) and edge case below traces to that audit.
> **Rule being enforced:**
> - **Buyer** = full shopping/purchasing.
> - **Seller** = Seller portal/fulfilment **+ only the public homepage/storefront**.
> - **Admin** = Admin portal/administration **+ only the public homepage/storefront**.
> - Seller/Admin must **not** reach product pages, category pages, cart, wishlist, Add to Cart, Buy Now, checkout, checkout resume, payment, or new-order creation.
> - **Guests** keep normal public catalog/product/category browsing.
> - Existing Seller Fulfilment, Admin, Buyer, inventory, Xendit/payment, returns/refunds, order history, barcode, shipping labels, and buyer→seller/admin isolation are **unaffected**.

---

## 0. Guiding principles

- **Security boundary = server + DB.** The real enforcement is: (a) a server-side role guard on buyer routes, (b) buyer-role assertions in the purchase/cart/wishlist server actions, (c) a role check inside `create_order`, and (d) an `orders` INSERT RLS backstop. Everything in the browser (hiding buttons, nav) is **UX only** and never trusted.
- **Role-aware, not auth-blunt.** Guests (unauthenticated) and buyers keep catalog access; only authenticated `seller`/`admin` are redirected. A plain `PROTECTED_ROUTE_PREFIXES` add would wrongly block guests — do **not** do that for catalog routes.
- **Additive, minimal scope.** Reuse `current_user_role()` (DEFINER helper, `20260802000100_initial_schema.sql:81`), `requireRole()` (`queries.ts:5077`), and `USER_ROLES`/`ROUTES`. Keep the existing self-purchase guard. Touch nothing in fulfilment/payment/inventory.
- **No data destruction.** Do not delete existing `carts`/`cart_items`/`wishlists` rows for accounts whose role changed — block writes + hide UI instead.

---

## 1. Role-aware routing / layout protection *(security boundary)*

**Target access matrix (authenticated):**

| Route group / prefix | Guest | Buyer | Seller | Admin |
|---|:---:|:---:|:---:|:---:|
| `(marketing)` homepage `/` | ✅ | ✅ | ✅ | ✅ |
| `(shop)` catalog: `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]` | ✅ | ✅ | ❌→`/seller`·`/admin` | ❌→`/admin` |
| `(shop)` buyer-txn: `/cart`, `/checkout`, `/checkout/resume/*`, `/wishlist` | guest: cart only (client) | ✅ | ❌ | ❌ |
| `/account`, `/orders`, `/profile`, `/addresses`, `/notifications` (buyer account) | ❌ (auth) | ✅ | see §note | see §note |
| `/seller/**` | ❌ | ❌ | ✅ | ✅ (admin allowed today) |
| `/admin/**` | ❌ | ❌ | ❌ | ✅ |

**Primary chokepoint — `src/app/(shop)/layout.tsx`:** convert to (or wrap with) a server component that resolves the session role and **redirects `seller`→`ROUTES.seller`, `admin`→`ROUTES.admin`** before rendering any `(shop)` child. This single guard covers **all** buyer surfaces (catalog, cart, checkout, wishlist) in one place. Guests and buyers fall through unchanged.
- *Nuance:* `(shop)/layout.tsx` is currently a pure presentational component and does not call Supabase. Making it `async` + reading the session is the cleanest option. Because it must NOT block guests, it only redirects when a session exists **and** role ∈ {seller, admin}.

**Secondary chokepoint — `src/proxy.ts`:** add a role-aware branch so a direct URL never even renders. Because the proxy already calls `updateSupabaseSession(request)` and has `user`, extend it to fetch the role (via the session/JWT claim or a lightweight lookup) and redirect seller/admin away from a new **`BUYER_ONLY_ROUTE_PREFIXES`** set. If reading role in the proxy is undesirable for cost/complexity, the layout guard is sufficient as the security boundary and the proxy change becomes optional polish.

**`§note` — buyer account routes (`/account`, `/orders`, `/profile`, …):** these are **out of scope** for this change. Sellers/admins manage orders via `/seller/orders` and `/admin/orders` (their legitimate reads). Do **not** redirect these here unless separately requested; the rule targets *shopping/purchasing*, not the shared account shell. (If desired later, handle separately — flagged, not included.)

**New constant (optional, recommended):** in `src/constants/routes.ts`, add `BUYER_ONLY_ROUTE_PREFIXES = ["/products","/categories","/cart","/checkout","/wishlist"]` used by both the layout/proxy guard — single source of truth, no literals scattered.

---

## 2. Server-action authorization *(security boundary)*

Add a **buyer-role assertion** (reuse `requireRole([USER_ROLES.buyer])`) at the top of every purchase/cart/wishlist mutation, replacing the bare `requireSessionUser()` where it is the authorization step. Friendly early rejection; RLS/RPC remain the true backstop.

| File | Functions | Change |
|---|---|---|
| `src/features/checkout/actions/checkout.actions.ts` | `placeOrderAction` (`:73`) | `requireRole([USER_ROLES.buyer])` instead of `requireSessionUser()`. |
| `src/features/cart/actions/cart.actions.ts` | `requireCartUser` (`:113`) and the mutations that use it (`addToCartAction`, `updateCartItemQuantityAction`, `removeCartItemAction`, `removeManyCartItemsAction`, `clearCartAction`, `mergeGuestCartAction`) | Gate mutations to buyers. **Keep public read paths** (`checkCartAvailabilityAction`, `getCartRecommendationsAction`, `getSimilarProductsAction`) unguarded — they're guest-accessible by design. `getMyCartAction` may stay `requireSessionUser` (harmless read) or be buyer-gated for consistency. |
| `src/features/wishlist/actions/*.ts` | wishlist add/remove/toggle mutations | Gate to buyers (currently `requireSessionUser` only). |

- Do **not** add role guards to Guided Selection / product-read / recommendation actions (guest-accessible precedent must hold).

---

## 3. `create_order` RPC protection *(security boundary — primary chokepoint)*

New migration (additive, `CREATE OR REPLACE`, no signature change) editing **both** `create_order` and `create_order_group` bodies:
- After deriving `v_buyer_id := auth.uid()` and the existing null check, add:
  `if public.current_user_role() <> 'buyer' then raise exception 'Only buyers can place orders' using errcode = '42501'; end if;`
- **Keep** the existing self-purchase guard (`if v_buyer_id = p_seller_id then raise …`, `20260927010000_…:82`) exactly as-is — the role check is additive.
- Latest current definitions: `create_order`/`create_order_group` in `supabase/migrations/20260927010000_create_order_payment_method_param.sql` (verify it's still the newest at implementation time; use `CREATE OR REPLACE` on the current signature to avoid the overload-ambiguity gotcha).
- Regenerate `src/lib/supabase/database.types.ts` after (function signatures unchanged, so likely a no-op diff, but run it per Migration Policy).

This is the **single most important** enforcement point: it closes the gap for the action path, direct RPC calls, and PostgREST alike.

---

## 4. `orders` INSERT RLS backstop *(security boundary)*

In the same migration, replace the `orders` INSERT policy `"buyers create their own orders"`:
- **Current:** `WITH CHECK (buyer_id = auth.uid() AND buyer_id <> seller_id)`
- **New:** `WITH CHECK (buyer_id = auth.uid() AND buyer_id <> seller_id AND public.current_user_role() = 'buyer')`
- Preserves ownership + self-purchase guard; adds the role clause. Uses the DEFINER helper (no `profiles` recursion). This blocks any direct `.from('orders').insert()` by a seller/admin even if the RPC were bypassed.
- **Do not touch** the orders SELECT/UPDATE policies, `enforce_order_update_rules`, or the `order_status` enum.

---

## 5. Cart / cart_items protection

- **Actions:** covered in §2 (buyer-gate mutations).
- **RLS (optional backstop, recommended for symmetry):** `carts` and `cart_items` INSERT (and UPDATE) policies are currently `user_id = auth.uid()` with no role clause. Optionally add `AND public.current_user_role() = 'buyer'` to their INSERT/UPDATE `WITH CHECK` so a seller/admin can never persist a cart even via direct PostgREST. SELECT stays unchanged (no data destruction; a demoted account can still *read* any leftover rows, which are simply never shown).
- **Guest cart unaffected** — it's client-side `localStorage`, no DB, no policy.
- **Decision to confirm:** cart RLS hardening is defense-in-depth. If we accept "blocked at checkout (§3/§4) + UI hidden (§7) + action-gated (§2)" as sufficient, the cart RLS change can be **skipped** to keep scope minimal. Recommend including it — it's a two-line additive policy change and makes the boundary uniform.

---

## 6. Wishlist protection

- **Actions:** covered in §2 (buyer-gate wishlist mutations).
- **RLS (optional backstop):** if `wishlists` INSERT is `user_id = auth.uid()` only, optionally add `AND public.current_user_role() = 'buyer'` to its `WITH CHECK`, same rationale as §5. SELECT unchanged. Confirm the current `wishlists` policy shape at implementation time.
- No data destruction for role-changed accounts.

---

## 7. UI hiding / cleanup for Seller/Admin *(UX only — NOT a security boundary)*

Purely cosmetic; the guards in §1–§6 are what actually enforce the rule. Because seller/admin are redirected out of `(shop)` (§1), most buyer UI is already unreachable — these steps prevent dead controls and confusing links on shared surfaces (mainly the marketing homepage, which all roles can see).

- `src/components/layout/SiteHeaderClient.tsx` — hide `CartPreview`, search-to-shop, and buyer nav for seller/admin. *(Note: `SiteHeader` renders in `(shop)` chrome which seller/admin won't reach; the relevant shared surface is the marketing header if it reuses these. Verify which header the `(marketing)` layout uses and hide buyer controls there.)*
- `AddToCartButton.tsx`, `BuyNowButton.tsx` — render nothing (or a disabled/informational state) for seller/admin. These appear on product pages (unreachable by seller/admin post-§1) and possibly on marketing featured-product tiles — the latter is the real case to handle.
- Any "featured products / shop now" CTAs on `(marketing)/page.tsx` that deep-link into `(shop)` — for seller/admin, either hide or let the §1 redirect catch them (redirect is the safety net; hiding is nicer UX).
- No change to seller/admin portal chrome.

---

## Exact files / functions / policies / migrations

**Code (server — security):**
- `src/app/(shop)/layout.tsx` — async role guard (redirect seller/admin).
- `src/proxy.ts` — optional role-aware redirect for `BUYER_ONLY_ROUTE_PREFIXES`.
- `src/features/checkout/actions/checkout.actions.ts` — `placeOrderAction` buyer gate.
- `src/features/cart/actions/cart.actions.ts` — buyer gate on cart mutations.
- `src/features/wishlist/actions/*.ts` — buyer gate on wishlist mutations.
- `src/constants/routes.ts` — add `BUYER_ONLY_ROUTE_PREFIXES` (optional constant).

**Code (UI — UX only):**
- `src/components/layout/SiteHeaderClient.tsx` (and the marketing header if distinct), `AddToCartButton.tsx`, `BuyNowButton.tsx`, marketing CTAs.

**Database (one new migration, additive):**
- `create_order` + `create_order_group` — add `current_user_role() = 'buyer'` guard (keep self-purchase guard).
- `orders` INSERT policy `"buyers create their own orders"` — add role clause to `WITH CHECK`.
- *(Optional)* `carts`/`cart_items`/`wishlists` INSERT/UPDATE policies — add role clause.
- Regenerate `src/lib/supabase/database.types.ts`.
- Update `MODULES.md` / `ARCHITECTURE.md` (RBAC section) + migration list.

---

## Implementation sequence (each step lint/typecheck/build-green)

1. **DB migration** (primary boundary): `create_order`/`create_order_group` role check + `orders` INSERT RLS clause (+ optional cart/wishlist policies). Verify live with rolled-back role-switched tests (seller/admin blocked; buyer passes; guest N/A). Regenerate types.
2. **Server actions**: buyer gates in `placeOrderAction`, cart mutations, wishlist mutations.
3. **Routing/layout guard**: `(shop)/layout.tsx` role redirect (+ optional `proxy.ts` + `BUYER_ONLY_ROUTE_PREFIXES`). Verify guest + buyer unaffected, seller/admin redirected.
4. **UI cleanup**: hide buyer controls on shared/marketing surfaces.
5. **Docs**: RBAC section + migration list.
6. **Full validation** (below).

*(DB-first so the security boundary lands before the UX; each layer independently verifiable.)*

---

## Security / RLS considerations

- Use `current_user_role()` (SECURITY DEFINER) inside RLS/RPC to avoid `profiles` RLS recursion — same pattern as existing policies.
- The **RPC + INSERT-RLS role checks are the authoritative boundary**; layout/proxy/action/UI are progressively softer layers. A pen-test that skips the UI and calls the RPC/PostgREST directly must still be blocked (steps §3/§4).
- Keep `is_admin()` semantics elsewhere intact — this change never grants admin new powers; it *removes* buyer powers from seller/admin.
- Rate-limit behavior on actions unchanged.

---

## Regression risks & mitigations

- **Guest catalog breakage (highest risk):** ensure the `(shop)` guard/proxy only redirects when role ∈ {seller, admin} — never on a null session. Explicit guest test case below.
- **Buyer flow breakage:** buyer must pass every new guard — full buyer purchase test required.
- **Seller/admin order reads:** confirm `/seller/orders`, `/admin/orders`, order detail, fulfilment, labels, barcode still work (they're outside `(shop)` and untouched).
- **`create_order` overload gotcha:** use `CREATE OR REPLACE` on the exact current signature; don't create a second overload.
- **Marketing CTAs:** a seller/admin clicking a homepage "Shop now" must be redirected (safety net) rather than hitting a broken page.
- **Type regen no-op:** signatures unchanged; expect minimal/no `database.types.ts` diff.

---

## Validation checklist

**Guest (unauthenticated)**
- [ ] `/`, `/products`, `/products/[slug]`, `/categories`, `/categories/[slug]` all load.
- [ ] `/cart` (client) works; can add to guest cart.
- [ ] Redirected to sign-in on `/checkout` (existing behavior, unchanged).

**Buyer**
- [ ] Full path: browse → Add to Cart / Buy Now → cart → checkout → payment → order created.
- [ ] Wishlist add/remove works; order history/tracking works.
- [ ] `create_order` succeeds (live/rolled-back).

**Seller**
- [ ] Redirected away from `/products`, `/categories`, `/cart`, `/checkout`, `/checkout/resume/*`, `/wishlist` (direct URL) → `/seller`.
- [ ] Add to Cart / Buy Now / cart controls not shown (or inert) on shared surfaces.
- [ ] `placeOrderAction` rejected; `create_order` RPC rejected (live 42501); direct `orders` INSERT rejected by RLS (live).
- [ ] Seller portal, `/seller/orders`, fulfilment, shipping label, barcode scan, returns — all still work.
- [ ] Homepage `/` still loads.

**Admin**
- [ ] Same redirects/rejections as Seller for buyer surfaces.
- [ ] Admin portal, `/admin/orders`, users/shops, payments, reports, inventory, returns/refunds — all still work.
- [ ] Homepage `/` still loads.

**Cross-cutting**
- [ ] `npm run lint` / `typecheck` / `build` green.
- [ ] Security advisor: no new issues; new policies present, `current_user_role()` used.
- [ ] No `carts`/`wishlists` rows deleted for any account.
- [ ] Live rolled-back matrix: {buyer→pass, seller→block, admin→block} for `create_order` + orders INSERT; guest catalog read unaffected.

---

## What must NOT be changed

- **Guest** catalog/product/category/search/Guided-Selection access.
- **Buyer** shopping/purchase/checkout/payment/order-history flow.
- **Seller Fulfilment**: `advanceOrderStatusAction`, `record_order_shipment`, item verification, shipping label, barcode scanner, buyer tracking.
- **Admin** functionality; **Inventory** (`adjust_stock`, restock triggers); **Xendit/payment** (webhook/RPCs, COD); **Returns/Refunds**.
- **orders SELECT & UPDATE RLS**, `enforce_order_update_rules`, `order_status` enum, `create_order`'s self-purchase guard and pricing/stock logic.
- Existing buyer→seller/admin isolation (seller/admin portal `requireRole` guards, seller↔seller isolation, buyer read-only tracking).
- Buyer **account/order-history reads** (not in scope; don't redirect `/account`,`/orders`,`/profile` here).

---

## Recommended architecture

**Four enforcement layers, DB-authoritative:**
1. **`(shop)` layout role guard** (redirect seller/admin) — covers all buyer routes in one chokepoint; role-aware so guests/buyers pass.
2. **Buyer-role assertions** in purchase/cart/wishlist actions — friendly rejection.
3. **`create_order`/`create_order_group` role check** — the primary DB chokepoint.
4. **`orders` INSERT RLS `current_user_role() = 'buyer'`** (+ optional cart/wishlist RLS) — final backstop against direct DB/PostgREST.

Plus **UI hiding** (UX only) on shared/marketing surfaces. Reuses `current_user_role()`, `requireRole()`, `USER_ROLES`, `ROUTES`. Preserves guest browsing, seller/admin order reads, self-purchase guard, and all existing cart/wishlist data. Minimal, additive, and fully reversible per step.

---

**No implementation performed. Awaiting approval before creating any code, migration, or configuration changes.**
