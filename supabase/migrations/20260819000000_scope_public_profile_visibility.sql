-- =============================================================================
-- Restrict public profile readability to seller/admin storefront identities
-- (auth audit finding M3).
--
-- Previously "profiles are publicly readable" (initial_schema, USING true)
-- exposed every profile row — including buyers' full_name/username/avatar_url/
-- bio — to anon and authenticated alike (phone was already withheld by a
-- later column-scoped grant). That let anyone scrape the full list of
-- registered buyer names, which is a privacy exposure the buyer role was
-- never meant to have; only sellers/admins have a legitimate public storefront
-- identity.
--
-- The replacement policy keeps public visibility for seller/admin rows (the
-- storefront use case) and a user's own row (self-service reads), and adds
-- two narrow carve-outs required by existing features that legitimately read
-- another user's buyer profile:
--   - an admin caller (is_admin()) can read any profile, matching every other
--     admin-wide read path in this schema;
--   - a seller can read the profile of a buyer who has placed an order with
--     them — orders/payments queries join profiles!orders_buyer_id_fkey to
--     show the buyer's name on the seller's order list and payment
--     verification queue (queries.ts ORDER_COLUMNS / PAYMENT_COLUMNS), and
--     that join is itself RLS-gated on this table.
-- Everyone else (including anon and other buyers) can no longer read a
-- buyer's profile row.
-- =============================================================================

begin;

drop policy if exists "profiles are publicly readable" on public.profiles;

create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (
    role in ('seller', 'admin')
    or id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.orders o
      where o.buyer_id = profiles.id
        and o.seller_id = (select auth.uid())
    )
  );

commit;
