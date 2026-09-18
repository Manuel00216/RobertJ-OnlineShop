begin;

-- =============================================================================
-- New, dedicated `shop-images` bucket for seller-uploaded shop logo/banner
-- photos. Deliberately NOT a shared prefix inside `product-images` and its
-- RLS is NOT copied from that bucket's policies: `product-images`' INSERT/
-- DELETE predicate is hard-coded to join against `public.products`, which
-- has nothing to do with shop branding. This bucket's policies instead join
-- directly against `public.shop_users` (the actual membership table), kept
-- fully isolated from the product-image policies so neither can regress the
-- other.
--
-- Path convention (server-controlled, never client-chosen):
--   {shop_id}/logo/{uuid}.{ext}
--   {shop_id}/banner/{uuid}.{ext}
-- `storage.foldername(name)` gives [shop_id, 'logo'|'banner']; the INSERT
-- policy checks both the membership AND that segment 2 is exactly 'logo' or
-- 'banner', so a caller can't smuggle a file into an unexpected sub-path.
--
-- The path segment is compared as TEXT against `shop_users.shop_id::text`
-- (never cast the arbitrary path segment itself to uuid), avoiding a
-- cast-exception failure mode for a malformed/malicious path — same safety
-- shape as the existing `product-images` policy's `p.id::text = ...` join.
--
-- ROLLBACK:
--   drop policy if exists "shop members write shop images" on storage.objects;
--   drop policy if exists "shop members delete shop images" on storage.objects;
--   drop policy if exists "shop images are publicly readable" on storage.objects;
--   delete from storage.buckets where id = 'shop-images';
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-images', 'shop-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "shop members write shop images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-images'
    and (storage.foldername(name))[2] = any (array['logo', 'banner'])
    and (
      exists (
        select 1
        from public.shop_users su
        where su.shop_id::text = (storage.foldername(name))[1]
          and su.user_id = (select auth.uid())
      )
      or public.is_admin()
    )
  );

create policy "shop members delete shop images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-images'
    and (
      exists (
        select 1
        from public.shop_users su
        where su.shop_id::text = (storage.foldername(name))[1]
          and su.user_id = (select auth.uid())
      )
      or public.is_admin()
    )
  );

create policy "shop images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'shop-images');

commit;
