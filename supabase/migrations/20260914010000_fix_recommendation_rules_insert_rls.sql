-- =============================================================================
-- Fix recommendation_rules INSERT policy (found while running the live
-- rolled-back-transaction verification for the Guided Product Selection
-- admin/seller UI).
--
-- 20260914000000_recommendation_rules.sql's own header comment claimed this
-- migration "starts from the already-corrected [product_variants] INSERT
-- shape" (20260912020000_fix_product_variants_insert_rls.sql), but the WITH
-- CHECK it actually shipped with still required the literal
-- `seller_id = (select auth.uid())` — the exact bug that fix migration
-- removed for product_variants. That silently blocked the two write paths
-- `createRecommendationRuleAction` is explicitly built to support: an admin
-- moderating any product (owner = null, so `seller_id`/`shop_id` come from
-- `getProductOwnerInfo`, never the admin's own id) and a shop co-member
-- managing a shared shop's product on another member's behalf. Confirmed live
-- via a rolled-back transaction: both paths raised
-- "new row violates row-level security policy".
--
-- Fix: same authorization shape as product_variants' corrected policy —
-- `p.seller_id = auth.uid() OR is_shop_member(p.shop_id) OR is_admin()`
-- decides who may perform the insert; the inserted row's seller_id/shop_id
-- must still match the real product's own (data integrity unchanged).
--
-- ROLLBACK: restore the original policy body from
-- 20260914000000_recommendation_rules.sql.
-- =============================================================================

begin;

drop policy "sellers insert their own rules" on public.recommendation_rules;

create policy "sellers insert their own rules"
  on public.recommendation_rules for insert
  to authenticated
  with check (
    public.current_user_role() in ('seller', 'admin')
    and exists (
      select 1 from public.products p
      where p.id = recommendation_rules.product_id
        and p.seller_id = recommendation_rules.seller_id
        and p.shop_id is not distinct from recommendation_rules.shop_id
        and (
          p.seller_id = (select auth.uid())
          or public.is_shop_member(p.shop_id)
          or public.is_admin()
        )
    )
  );

commit;
