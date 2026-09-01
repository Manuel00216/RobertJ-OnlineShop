-- =============================================================================
-- product_images SELECT policy: same shop-member/admin fallback as every
-- other product_images policy (see 20260901000000_product_image_shop_member_access.sql).
--
-- Root cause of a second, subtler manifestation of the same bug: Postgres
-- RLS requires a newly-INSERTed row to also satisfy the table's SELECT
-- policy whenever the statement has a RETURNING clause (which the app
-- always uses — `addProductImage()` does `.insert(...).select(...)`). The
-- INSERT policy was fixed to accept "own it, or it's in my shop", but this
-- SELECT policy still only allowed `status = 'active' OR seller_id = auth.uid()`.
-- For an active product this was invisible (the `status = 'active'` clause
-- happened to cover it), but for a non-active (draft/archived) product
-- whose `seller_id` doesn't match the caller, the INSERT would succeed and
-- then the whole statement would fail with "new row violates row-level
-- security policy" when Postgres re-checked the SELECT policy for RETURNING.
--
-- ROLLBACK:
--   drop policy if exists "product images follow product visibility" on public.product_images;
--   create policy "product images follow product visibility"
--     on public.product_images for select
--     to anon, authenticated
--     using (
--       exists (
--         select 1 from public.products p
--         where p.id = product_id
--           and (p.status = 'active' or p.seller_id = (select auth.uid()))
--       )
--     );
-- =============================================================================

begin;

drop policy if exists "product images follow product visibility" on public.product_images;
create policy "product images follow product visibility"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (
          p.status = 'active'
          or p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

commit;
