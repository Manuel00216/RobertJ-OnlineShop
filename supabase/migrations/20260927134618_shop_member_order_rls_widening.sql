-- =============================================================================
-- Widen orders/payments/return_requests/order_shipments RLS to additionally
-- grant shop members (is_shop_member(shop_id)), mirroring
-- 20260814000000_products_shop_scoping.sql's additive OR-widening shape
-- exactly. seller_id/buyer_id clauses are UNCHANGED — this only adds a
-- third OR branch, never narrows existing legitimate access.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
drop policy if exists "buyers and sellers read their own orders" on public.orders;
create policy "buyers and sellers read their own orders"
  on public.orders for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

drop policy if exists "buyers and sellers update their own orders" on public.orders;
create policy "buyers and sellers update their own orders"
  on public.orders for update
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  )
  with check (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- payments (no shop_id column — widen via the existing orders join)
-- ---------------------------------------------------------------------------
drop policy if exists "payments readable by order participants" on public.payments;
create policy "payments readable by order participants"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.buyer_id = (select auth.uid())
             or o.seller_id = (select auth.uid())
             or public.is_shop_member(o.shop_id)
             or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- return_requests
-- ---------------------------------------------------------------------------
drop policy if exists "buyers sellers and admins read their return requests" on public.return_requests;
create policy "buyers sellers and admins read their return requests"
  on public.return_requests for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- order_shipments
-- ---------------------------------------------------------------------------
drop policy if exists "participants read order shipments" on public.order_shipments;
create policy "participants read order shipments"
  on public.order_shipments for select
  to authenticated
  using (
    public.is_shop_member(shop_id)
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.buyer_id = (select auth.uid())
             or o.seller_id = (select auth.uid())
             or public.is_admin())
    )
  );

drop policy if exists "seller or admin insert own order shipment" on public.order_shipments;
create policy "seller or admin insert own order shipment"
  on public.order_shipments for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_shop_member(shop_id)
    or (
      seller_id = (select auth.uid())
      and exists (
        select 1 from public.orders o
        where o.id = order_id and o.seller_id = (select auth.uid())
      )
    )
  );

drop policy if exists "seller or admin update own order shipment" on public.order_shipments;
create policy "seller or admin update own order shipment"
  on public.order_shipments for update
  to authenticated
  using (seller_id = (select auth.uid()) or public.is_shop_member(shop_id) or public.is_admin())
  with check (seller_id = (select auth.uid()) or public.is_shop_member(shop_id) or public.is_admin());

commit;
