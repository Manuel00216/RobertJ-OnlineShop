-- ============================================================================
-- Fix: create_order_group's idempotency replay path had no fail-closed guard
-- for a claimed-but-incomplete key, unlike create_order's identical case.
--
-- If a group-checkout attempt claimed the idempotency key and then died
-- before the final `order_ids` update (should not persist past the owning
-- transaction, but neither should the equivalent gap in create_order, which
-- already guards against it), a retry with the same key hit the replay
-- branch and silently returned an EMPTY result set with no error — the
-- buyer would see an apparently successful checkout with zero orders
-- actually created.
--
-- Same signature as the live function (see 20261004155216_order_creation_
-- idempotency.sql) — CREATE OR REPLACE in place, no DROP, so Postgres keeps
-- the existing ACL (authenticated + service_role only, no anon) instead of
-- resetting it to the PUBLIC-EXECUTE default the way a DROP+CREATE would.
-- ============================================================================

begin;

create or replace function public.create_order_group(
  p_groups jsonb,
  p_shipping_address jsonb,
  p_shipping_fee_cents integer default 0,
  p_notes text default null,
  p_payment_method text default 'cod',
  p_idempotency_key uuid default null
)
returns setof public.orders
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_group_id uuid := gen_random_uuid();
  v_group    jsonb;
  v_buyer    uuid := (select auth.uid());
  v_order    public.orders;
  v_created  uuid[] := '{}';
  -- Nil UUID: the scope for a whole-group attempt. A real seller_id is never
  -- the nil UUID, so this can't collide with a single-order scope.
  v_scope    constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'At least one seller group is required' using errcode = '22023';
  end if;

  -- Group-level idempotency: replay the whole batch on a repeat. (Guarded on a
  -- non-null buyer so the dedup insert can't hit a NOT NULL before the inner
  -- create_order raises its own 'Authentication required'.)
  if p_idempotency_key is not null and v_buyer is not null then
    insert into public.order_idempotency_keys (buyer_id, idempotency_key, scope)
    values (v_buyer, p_idempotency_key, v_scope)
    on conflict (buyer_id, idempotency_key, scope) do nothing;

    if not found then
      -- Key already claimed. If the recorded order_ids is still empty, the
      -- claiming attempt never finished (and per create_order's identical
      -- guard, shouldn't persist past its own transaction) — fail closed
      -- rather than silently return zero orders as if that were success.
      if not exists (
        select 1
        from public.order_idempotency_keys k
        where k.buyer_id = v_buyer
          and k.idempotency_key = p_idempotency_key
          and k.scope = v_scope
          and coalesce(array_length(k.order_ids, 1), 0) > 0
      ) then
        raise exception 'Duplicate order submission' using errcode = '23505';
      end if;

      return query
        select o.*
        from public.orders o
        join public.order_idempotency_keys k
          on k.buyer_id = v_buyer
         and k.idempotency_key = p_idempotency_key
         and k.scope = v_scope
        where o.id = any (k.order_ids)
        order by o.placed_at, o.id;
      return;
    end if;
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    -- No p_idempotency_key here: the group-level claim above is the single
    -- dedup point; inner calls must not self-dedup.
    v_order := public.create_order(
      p_seller_id          := (v_group ->> 'seller_id')::uuid,
      p_items              := v_group -> 'items',
      p_shipping_address   := p_shipping_address,
      p_shipping_fee_cents := p_shipping_fee_cents,
      p_notes              := p_notes,
      p_checkout_group_id  := v_group_id,
      p_payment_method     := p_payment_method
    );
    v_created := v_created || v_order.id;
    return next v_order;
  end loop;

  if p_idempotency_key is not null and v_buyer is not null then
    update public.order_idempotency_keys
    set order_ids = v_created
    where buyer_id = v_buyer
      and idempotency_key = p_idempotency_key
      and scope = v_scope;
  end if;

  return;
end;
$fn$;

commit;
