-- =============================================================================
-- Return/refund restock — approved design: restock does NOT happen
-- automatically when a return is approved. `decide_return` (unchanged by
-- this migration) still only handles the refund. A separate step lets the
-- order's seller (or a shop member) or an admin record whether the
-- physically-returned item is actually sellable; only then does stock come
-- back — a damaged/non-resellable item is recorded and never restocked.
--
-- `record_return_item_condition` is the sole write path, mirroring
-- `restock_on_order_cancel`'s exact mechanics for the "sellable" branch
-- (same inventory lock ordering, same stock_adjustments ledger shape) — no
-- second restock path. Uses the 'return_restock' stock_adjustment_reason
-- added in the previous migration.
--
-- Four new nullable/defaulted columns on return_requests record the outcome
-- (mirrors the existing seller_decided_at/admin_decided_at shape):
--   restocked_at          — set only on the sellable branch.
--   marked_unsellable_at  — set only on the not-sellable branch.
--   condition_note        — optional free-text note either way.
--   condition_recorded_by — who recorded it.
-- Exactly one of restocked_at/marked_unsellable_at is ever set; both null
-- means the condition hasn't been recorded yet. "No direct INSERT/UPDATE
-- grant" on return_requests is preserved — writes stay RPC-only.
-- =============================================================================

begin;

alter table public.return_requests
  add column if not exists restocked_at          timestamptz null,
  add column if not exists marked_unsellable_at   timestamptz null,
  add column if not exists condition_note         text null,
  add column if not exists condition_recorded_by  uuid null references public.profiles (id) on delete set null;

alter table public.return_requests
  add constraint return_requests_condition_note_length
    check (condition_note is null or char_length(condition_note) <= 500);

comment on column public.return_requests.restocked_at is
  'Set once the returned item was confirmed sellable and inventory was restored (record_return_item_condition). Null until then.';
comment on column public.return_requests.marked_unsellable_at is
  'Set once the returned item was explicitly confirmed NOT sellable (damaged/non-resellable) — closes out the condition-check step without restocking.';

-- -----------------------------------------------------------------------------
-- record_return_item_condition: seller (of the order), shop member, or admin
-- records whether a refunded return's item is sellable. 'sellable' restocks
-- (whole order → every order_items row; item-level → just that item),
-- mirroring restock_on_order_cancel's lock-inventory-then-update-then-log
-- shape exactly. 'not_sellable' just records the outcome — no stock write.
-- -----------------------------------------------------------------------------
create or replace function public.record_return_item_condition(
  p_return_id uuid,
  p_condition text,
  p_note      text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_request   public.return_requests;
  v_order     public.orders;
  v_item      record;
  v_inventory public.inventory;
begin
  if v_uid is null then
    raise exception 'You must be signed in to record item condition' using errcode = '42501';
  end if;

  if p_condition not in ('sellable', 'not_sellable') then
    raise exception 'Invalid condition' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'refunded' then
    raise exception 'Only a refunded return request can have its item condition recorded'
      using errcode = '23514';
  end if;

  if v_request.restocked_at is not null or v_request.marked_unsellable_at is not null then
    raise exception 'This return''s item condition has already been recorded'
      using errcode = '23514';
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_order.seller_id
     and not public.is_admin()
     and not public.is_shop_member(v_order.shop_id)
  then
    raise exception 'You do not have permission to record this return''s item condition'
      using errcode = '42501';
  end if;

  if p_condition = 'not_sellable' then
    update public.return_requests
    set marked_unsellable_at = now(),
        condition_note = p_note,
        condition_recorded_by = v_uid
    where id = p_return_id
    returning * into v_request;

    return v_request;
  end if;

  -- 'sellable': restock. Whole-order return (order_item_id is null)
  -- restocks every line item; an item-level return restocks just that one.
  if v_request.order_item_id is null then
    for v_item in
      select product_id, variant_id, quantity
      from public.order_items
      where order_id = v_request.order_id
    loop
      if v_item.variant_id is not null then
        select * into v_inventory from public.inventory where variant_id = v_item.variant_id for update;
      else
        select * into v_inventory from public.inventory
          where product_id = v_item.product_id and variant_id is null for update;
      end if;

      if not found then
        continue; -- defensive only, mirrors restock_on_order_cancel
      end if;

      update public.inventory
      set quantity = v_inventory.quantity + v_item.quantity
      where id = v_inventory.id;

      insert into public.stock_adjustments (
        product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
        reason, note, related_order_id, created_by
      ) values (
        v_item.product_id, v_item.variant_id, v_inventory.shop_id, v_item.quantity,
        v_inventory.quantity, v_inventory.quantity + v_item.quantity,
        'return_restock', 'Restocked from approved return on order ' || v_order.order_number,
        v_order.id, v_uid
      );
    end loop;
  else
    select product_id, variant_id, quantity into v_item
    from public.order_items
    where id = v_request.order_item_id;

    if v_item.variant_id is not null then
      select * into v_inventory from public.inventory where variant_id = v_item.variant_id for update;
    else
      select * into v_inventory from public.inventory
        where product_id = v_item.product_id and variant_id is null for update;
    end if;

    if found then
      update public.inventory
      set quantity = v_inventory.quantity + v_item.quantity
      where id = v_inventory.id;

      insert into public.stock_adjustments (
        product_id, variant_id, shop_id, delta, previous_quantity, new_quantity,
        reason, note, related_order_id, created_by
      ) values (
        v_item.product_id, v_item.variant_id, v_inventory.shop_id, v_item.quantity,
        v_inventory.quantity, v_inventory.quantity + v_item.quantity,
        'return_restock', 'Restocked from approved return on order ' || v_order.order_number,
        v_order.id, v_uid
      );
    end if;
  end if;

  update public.return_requests
  set restocked_at = now(),
      condition_note = p_note,
      condition_recorded_by = v_uid
  where id = p_return_id
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.record_return_item_condition(uuid, text, text) to authenticated;

commit;
