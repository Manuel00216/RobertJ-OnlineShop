-- =============================================================================
-- Products module: Supabase Storage bucket for product photos, plus a small
-- RLS parity fix on `product_images`.
--
-- Design notes:
--  * Public bucket (unlike `payment-receipts`): product photos are meant to be
--    seen by every shopper, including guests, and `next.config.ts` already
--    allowlists the Supabase Storage host under `images.remotePatterns` with
--    a comment anticipating this exact bucket.
--  * Path convention `{product_id}/{uuid}.{ext}`, same reasoning as
--    `payment-receipts`: the path segment is the authorization key, checked
--    via `(storage.foldername(name))[1]` against `public.products`, never a
--    client-asserted seller id.
--  * `product_images` (see `20260802000100_initial_schema.sql`) already has
--    insert/update/delete RLS scoped to `p.seller_id = auth.uid()`, but —
--    unlike every other seller-owned table in this schema (products, orders,
--    payments) — it never included `or is_admin()`. That's a real defect:
--    an admin managing a seller's product through the same dashboard form
--    would be silently blocked by RLS on the image write. Fixed here by
--    re-creating the three policies with the same `or public.is_admin()`
--    clause every other seller-owned policy already has.
--
-- ROLLBACK:
--   drop policy if exists "product image owners write to storage" on storage.objects;
--   drop policy if exists "product image owners delete from storage" on storage.objects;
--   drop policy if exists "product images are publicly readable" on storage.objects;
--   delete from storage.buckets where id = 'product-images';
--   -- revert product_images policies to their initial_schema.sql versions
--   -- (drop the "or public.is_admin()" clause) if this needs to be undone.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "product image owners write to storage" on storage.objects;
create policy "product image owners write to storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[1]
        and (p.seller_id = (select auth.uid()) or public.is_admin())
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
        and (p.seller_id = (select auth.uid()) or public.is_admin())
    )
  );

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- ---------- product_images RLS parity fix (admin missing from write policies) ----------

drop policy if exists "sellers insert images for their products" on public.product_images;
create policy "sellers insert images for their products"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.seller_id = (select auth.uid()) or public.is_admin())
    )
  );

drop policy if exists "sellers update images for their products" on public.product_images;
create policy "sellers update images for their products"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.seller_id = (select auth.uid()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.seller_id = (select auth.uid()) or public.is_admin())
    )
  );

drop policy if exists "sellers delete images for their products" on public.product_images;
create policy "sellers delete images for their products"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.seller_id = (select auth.uid()) or public.is_admin())
    )
  );

commit;
