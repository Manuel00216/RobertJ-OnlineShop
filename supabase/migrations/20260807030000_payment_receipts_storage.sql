-- =============================================================================
-- Payments Module (Phase 7), part 3: Supabase Storage for QR payment receipts
-- — the FIRST Storage feature in this repo. Private bucket; every access path
-- is gated by RLS on `storage.objects`, never a public bucket URL.
--
-- Design notes:
--  * Path convention: `{order_id}/{uuid}-{filename}` — deliberately does NOT
--    also embed the buyer's id. A path-embedded buyer_id would be spoofable
--    (an attacker could upload under a real order_id with their own uid
--    segment); every policy instead subqueries `public.orders` via the
--    path-embedded order_id, which is the actual source of truth for both the
--    buyer's AND the seller's identity on that object.
--  * Compare `o.id::text = (storage.foldername(name))[1]`, not the reverse —
--    casting the known uuid to text is always safe; casting an
--    attacker-controlled path segment to uuid can raise a cast exception on a
--    malformed path, which is unnecessary error surface for something RLS
--    should just evaluate to `false`.
--  * SELECT policy covers buyer, seller, and admin in one policy — the same
--    "own row or is_admin()" shape already used by the `payments` SELECT
--    policy, just re-pointed at `storage.objects` via the order join.
--  * No UPDATE/DELETE policy at all, mirroring `orders`'s "no DELETE —
--    financial records are append-mostly" stance. A wrong upload means a
--    fresh `submit_qr_payment` call after the old one is marked `failed`
--    (see the RPC migration), not mutating evidence in place.
--  * Never granted `to anon`/`to public` — receipts can carry bank/e-wallet
--    references. `file_size_limit`/`allowed_mime_types` are enforced at the
--    bucket level since RLS can't meaningfully validate file content.
--
-- ROLLBACK:
--   drop policy "buyers upload receipts for their own orders" on storage.objects;
--   drop policy "order participants read payment receipts" on storage.objects;
--   delete from storage.buckets where id = 'payment-receipts';
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "buyers upload receipts for their own orders" on storage.objects;
create policy "buyers upload receipts for their own orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "order participants read payment receipts" on storage.objects;
create policy "order participants read payment receipts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (o.buyer_id = (select auth.uid())
             or o.seller_id = (select auth.uid())
             or public.is_admin())
    )
  );

commit;
