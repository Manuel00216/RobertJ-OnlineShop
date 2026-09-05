begin;

-- =============================================================================
-- Adds real seller-owned shop branding fields: logo_url, banner_url,
-- description. Logo/banner are never arbitrary external URLs — the CHECK
-- constraints below tie each URL to the row's OWN id and the
-- server-controlled `shop-images/{shop_id}/{logo|banner}/...` path
-- convention, so even a direct SQL write can't attach another shop's image
-- or an off-platform URL. The app layer (queries.ts) reinforces this by
-- always constructing the URL itself from a real Storage upload result —
-- it never accepts a client-submitted URL.
--
-- UPDATE authorization: no new RLS policy is added for the UPDATE command
-- beyond this migration's own policy below — "only admins update shops"
-- stays untouched. The new "shop members update own shop profile" policy is
-- additive (Postgres ORs permissive policies of the same command), and is
-- row-level like all RLS: the actual column-level restriction (a seller can
-- only ever cause logo_url/banner_url/description to be written, never
-- name/active/slug) is enforced by the query-layer functions
-- (updateOwnShopDescription/replaceShopImage/removeShopImage), not by RLS.
--
-- ROLLBACK:
--   alter table public.shops
--     drop constraint if exists shops_logo_url_path,
--     drop constraint if exists shops_banner_url_path,
--     drop constraint if exists shops_description_length,
--     drop column if exists logo_url,
--     drop column if exists banner_url,
--     drop column if exists description;
--   drop policy if exists "shop members update own shop profile" on public.shops;
-- =============================================================================

alter table public.shops
  add column logo_url text,
  add column banner_url text,
  add column description text;

alter table public.shops
  add constraint shops_logo_url_path
    check (
      logo_url is null
      or logo_url like ('%/storage/v1/object/public/shop-images/' || id::text || '/logo/%')
    ),
  add constraint shops_banner_url_path
    check (
      banner_url is null
      or banner_url like ('%/storage/v1/object/public/shop-images/' || id::text || '/banner/%')
    ),
  add constraint shops_description_length
    check (description is null or char_length(description) <= 500);

create policy "shop members update own shop profile"
  on public.shops for update
  to authenticated
  using (public.is_shop_member(id))
  with check (public.is_shop_member(id));

commit;
