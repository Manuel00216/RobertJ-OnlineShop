-- =============================================================================
-- Fix product_variants INSERT policy (found while wiring Phase 3b's admin
-- variant-management path).
--
-- The Phase 3a policy (20260912010000_product_variants.sql) required
-- `seller_id = (select auth.uid())` unconditionally in its WITH CHECK. That
-- silently blocks an admin (or a different member of the same shop) from
-- ever creating a variant attributed to the product's actual owning seller
-- — contradicting the admin-moderates-any-product pattern every other
-- product/inventory write path already follows (see `updateProductAction`'s
-- `owner = null` for admin, `adjust_stock`'s seller-or-shop-member-or-admin
-- check).
--
-- Fix: authorization now matches the UPDATE/DELETE policies' shape exactly
-- — seller_id = auth.uid() OR is_shop_member(shop_id) OR is_admin() decides
-- who may perform the insert. Data integrity is unchanged: the inserted
-- row's seller_id/shop_id must still match the real product's own.
--
-- ROLLBACK: restore the original policy body from
-- 20260912010000_product_variants.sql.
-- =============================================================================

begin;

drop policy "sellers insert their own variants" on public.product_variants;

create policy "sellers insert their own variants"
  on public.product_variants for insert
  to authenticated
  with check (
    public.current_user_role() in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.seller_id = product_variants.seller_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

commit;
