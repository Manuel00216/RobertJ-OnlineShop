-- =============================================================================
-- Product image RLS: allow shop members, not just the literal seller_id.
--
-- Design notes:
--  * Every other `products` policy already treats "own it (seller_id match)"
--    OR "is_shop_member(shop_id)" OR "is_admin()" as sufficient — e.g.
--    "sellers update their own products". Product image write/delete (both
--    the `product_images` table and the `product-images` storage bucket)
--    was narrower: `seller_id = auth.uid() OR is_admin()` only, with no
--    shop-membership clause. That's an inconsistency, not an intentional
--    narrower rule — a product whose `seller_id` predates shop assignment
--    (or was created by a different member of the same shop) is fully
--    visible and editable via every other mutation, but image upload/delete
--    was silently rejected ("Product not found" from the app-level check
--    that mirrors this RLS, `productBelongsToOwner` in queries.ts).
--  * Fixed here by adding the same `or public.is_shop_member(p.shop_id)`
--    clause every other `products` policy already has, to both the
--    `product_images` table policies and the `product-images` storage
--    bucket policies.
--
-- ROLLBACK:
--   Re-apply 20260824000000_product_images_storage.sql's policy bodies
--   (drop the "or public.is_shop_member(p.shop_id)" clause) to revert.
-- =============================================================================

begin;

drop policy if exists "product image owners write to storage" on storage.objects;
create policy "product image owners write to storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[1]
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

drop policy if exists "product image owners delete from storage" on storage.objects;
create policy "product image owners delete from storage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[1]
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

drop policy if exists "sellers insert images for their products" on public.product_images;
create policy "sellers insert images for their products"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

drop policy if exists "sellers update images for their products" on public.product_images;
create policy "sellers update images for their products"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

drop policy if exists "sellers delete images for their products" on public.product_images;
create policy "sellers delete images for their products"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

commit;
