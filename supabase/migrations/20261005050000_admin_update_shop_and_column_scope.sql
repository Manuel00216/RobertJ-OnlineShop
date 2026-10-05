-- =============================================================================
-- Admin audit fix #1 — shops UPDATE RLS was row-scoped but not column-scoped.
--
-- `shops` had two UPDATE RLS policies ORed together ("only admins update
-- shops": is_admin(), "shop members update own shop profile":
-- is_shop_member(id)), but the table-level grant was a blanket
-- `grant update on shops to authenticated` across every column. RLS
-- restricts which ROW can be updated, not which COLUMNS — so a seller,
-- calling the Supabase client directly with their own normal session
-- (bypassing the Next.js app and its admin-only `updateShopAction`/
-- `toggleShopActiveAction` guards entirely), could rename or deactivate
-- their own shop. Verified live before writing this: the grant covered
-- every column including name/active/slug.
--
-- Fix: admin's full-column update path moves to a new SECURITY DEFINER RPC
-- (admin_update_shop, mirroring admin_assign_seller_shop's shape — explicit
-- is_admin() check inside, never trusts RLS alone). The plain client-facing
-- UPDATE grant is narrowed to exactly the columns sellers' own actions
-- actually write (verified against live code before writing this):
-- `updateOwnShopDescriptionAction` -> description only;
-- `uploadShopImageAction`/`removeShopImageAction` -> logo_url/banner_url
-- only. A seller's own-row RLS policy (is_shop_member(id)) is now only ever
-- consulted for those 3 columns in practice, since the grant blocks every
-- other column before RLS is even reached.
--
-- createShop's INSERT path is untouched — its RLS policy (with_check
-- is_admin()) already correctly gates by caller identity regardless of
-- which columns are set on the new row; there is no equivalent gap there.
--
-- ROLLBACK:
--   revoke update on public.shops from authenticated;
--   grant update on public.shops to authenticated;
--   revoke execute on function public.admin_update_shop(uuid, text, boolean) from authenticated;
--   drop function public.admin_update_shop(uuid, text, boolean);
-- =============================================================================

begin;

create or replace function public.admin_update_shop(
  p_shop_id uuid,
  p_name text default null,
  p_active boolean default null
)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_shop public.shops;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to update this shop' using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Shop not found' using errcode = 'P0002';
  end if;

  update public.shops
  set
    name = coalesce(p_name, name),
    active = coalesce(p_active, active)
  where id = p_shop_id
  returning * into v_shop;

  return v_shop;
end;
$$;

comment on function public.admin_update_shop is
  'Admin-only: edits a shop''s name/active status. The sole path for those columns now that shops'' UPDATE grant to authenticated is scoped to description/logo_url/banner_url only (sellers'' own-row RLS policy is row-level, not column-level, so the grant is what keeps a seller from writing name/active/slug).';

revoke all on function public.admin_update_shop(uuid, text, boolean) from public, anon;
grant execute on function public.admin_update_shop(uuid, text, boolean) to authenticated;

revoke update on public.shops from authenticated;
grant update (description, logo_url, banner_url) on public.shops to authenticated;

commit;
