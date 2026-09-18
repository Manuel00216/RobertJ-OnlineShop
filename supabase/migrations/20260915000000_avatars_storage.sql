-- =============================================================================
-- New `avatars` bucket for buyer/seller/admin profile-picture uploads
-- (Profile page redesign — previously a pasted external URL only, per
-- `AvatarPreview`'s own "uploads aren't available yet" hint).
--
-- Path convention (server-controlled, never client-chosen):
--   {user_id}/{uuid}.{ext}
-- `storage.foldername(name)` gives [user_id] — a single segment, since an
-- avatar has no membership/ownership concept beyond "it's yours" (unlike
-- shop-images' shop_id + shop_users join). RLS just compares that segment
-- to auth.uid(), same safety shape (text comparison, never cast the
-- arbitrary path segment to uuid) as the existing shop-images/product-images
-- policies.
--
-- Small size limit (1MB) and JPEG/PNG only — a profile picture, not a
-- product/shop photo; no WebP to keep this a deliberately narrow surface.
--
-- ROLLBACK:
--   drop policy if exists "users write their own avatar" on storage.objects;
--   drop policy if exists "users delete their own avatar" on storage.objects;
--   drop policy if exists "avatars are publicly readable" on storage.objects;
--   delete from storage.buckets where id = 'avatars';
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "users write their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

commit;
