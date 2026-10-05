-- =============================================================================
-- Seller audit fix #2 — product_variants.seller_id: cascade -> set null.
--
-- Mirrors products.seller_id's exact fix in 20260928054321_seller_hard_delete_
-- support.sql. That migration deliberately left product_variants.seller_id as
-- `on delete cascade`, verified safe only because the accounts it unblocked
-- had zero variant rows at the time — not a general guarantee.
--
-- Without this fix, hard-deleting a seller with variant products that have
-- order history fails: deleting the profile cascades to delete the seller's
-- product_variants rows, which order_items.variant_id (`on delete restrict`)
-- then blocks, failing the whole admin_hard_delete_seller_account transaction.
--
-- The variant row itself is never deleted by this change — it survives with
-- no seller, same as its parent product already does. `create_order`'s
-- existing seller `is_active` guard already refuses to sell against an
-- account with no seller at all (`id = null` matches nothing), so this is no
-- new exposure.
--
-- ROLLBACK:
--   alter table public.product_variants drop constraint product_variants_seller_id_fkey;
--   alter table public.product_variants alter column seller_id set not null;
--   alter table public.product_variants add constraint product_variants_seller_id_fkey foreign key (seller_id) references public.profiles (id) on delete cascade;
-- =============================================================================

begin;

alter table public.product_variants drop constraint product_variants_seller_id_fkey;
alter table public.product_variants alter column seller_id drop not null;
alter table public.product_variants
  add constraint product_variants_seller_id_fkey
  foreign key (seller_id) references public.profiles (id) on delete set null;

commit;
