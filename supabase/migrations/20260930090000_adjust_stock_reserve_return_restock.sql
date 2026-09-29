-- =============================================================================
-- adjust_stock already reserves 'initial_stock'/'sale'/'cancellation_restock'
-- for system-driven adjustments only. Adds 'return_restock' (introduced by
-- 20260930050000/20260930060000 for record_return_item_condition) to that
-- same reserved list — without this, a seller/admin could call adjust_stock
-- directly and fake a 'return_restock' log entry that didn't actually come
-- from a confirmed-sellable return, undermining the stock_adjustments audit
-- trail's honesty. Byte-identical to the live definition
-- (20260912010000_product_variants.sql) except that one line.
-- =============================================================================

begin;

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     public.stock_adjustment_reason,
  p_note       text default null,
  p_variant_id uuid default null
)
returns public.inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid               uuid := (select auth.uid());
  v_role               public.user_role;
  v_product            public.products;
  v_variant            public.product_variants;
  v_inventory          public.inventory;
  v_previous_quantity  integer;
  v_new_quantity       integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in to adjust stock' using errcode = '42501';
  end if;

  v_role := public.current_user_role();
  if v_role not in ('seller', 'admin') then
    raise exception 'You do not have permission to adjust stock' using errcode = '42501';
  end if;

  if p_delta = 0 then
    raise exception 'Adjustment must not be zero' using errcode = '22023';
  end if;

  if p_reason in ('initial_stock', 'sale', 'cancellation_restock', 'return_restock') then
    raise exception 'This reason is reserved for system-driven adjustments'
      using errcode = '22023';
  end if;

  -- Plain (non-locking) read: only needed for the authorization check, never
  -- written here, so it cannot participate in the inventory-then-products
  -- lock ordering described at the top of the parent migration.
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if v_product.seller_id <> v_uid
     and not public.is_shop_member(v_product.shop_id)
     and not public.is_admin()
  then
    raise exception 'You do not have permission to adjust stock for this product'
      using errcode = '42501';
  end if;

  if p_variant_id is not null then
    -- Plain (non-locking) read — same reasoning as the products read above;
    -- product_variants is never FOR UPDATE-locked by this RPC.
    select * into v_variant
    from public.product_variants
    where id = p_variant_id;

    if not found or v_variant.product_id <> p_product_id then
      raise exception 'Variant not found for this product' using errcode = 'P0002';
    end if;

    select * into v_inventory
    from public.inventory
    where variant_id = p_variant_id
    for update;
  else
    select * into v_inventory
    from public.inventory
    where product_id = p_product_id and variant_id is null
    for update;
  end if;

  if not found then
    raise exception 'Inventory record not found for this product' using errcode = 'P0002';
  end if;

  v_previous_quantity := v_inventory.quantity;
  v_new_quantity := v_previous_quantity + p_delta;

  if v_new_quantity < 0 then
    raise exception 'Cannot reduce stock below zero (currently %)', v_previous_quantity
      using errcode = '23514';
  end if;

  update public.inventory
  set quantity = v_new_quantity
  where id = v_inventory.id
  returning * into v_inventory;

  insert into public.stock_adjustments (
    product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
    reason, note, created_by
  )
  values (
    p_product_id, p_variant_id, v_inventory.shop_id, p_delta, v_previous_quantity,
    v_new_quantity, p_reason, p_note, v_uid
  );

  return v_inventory;
end;
$$;

commit;
