-- =============================================================================
-- Fix: "Couldn't start payment — duplicate key value violates unique
-- constraint payments_xendit_payment_request_id_key" on a group Pay Now
-- retry, reproduced live against a real checkout group
-- (7ea6face-906b-43fb-b395-61884b53a3ed) before writing this migration.
--
-- Root cause: `begin_xendit_group_payment_attempt` inserts a brand new
-- 'pending' payments row per order whenever no existing row matches its
-- reuse window (e.g. the previous row's `xendit_payment_request_id` is
-- still null -- the Xendit call never happened or never got a response --
-- and it's older than the 2-minute in-flight grace period). It never marks
-- those superseded rows anything other than 'pending', so every retry
-- across that window (several, here, while `XENDIT_SECRET_KEY` was
-- invalid -- see prior session) piles up another 'pending' row per order
-- with no cap. `finalize_xendit_group_payment_request`'s UPDATE is scoped
-- only to `(checkout_group_id, payment_channel, status = 'pending')` --
-- with 3+ 'pending' rows sitting on the same order, one UPDATE statement
-- tries to set all of them to the same new `xendit_payment_request_id` in
-- one shot, which collides with `payments_xendit_payment_request_id_key`
-- (a UNIQUE (xendit_payment_request_id, order_id) constraint -- two rows,
-- same order_id, now the same request id too).
--
-- Two-part fix, both verified against the real broken group in a
-- rolled-back transaction before applying:
--
-- 1. `finalize_xendit_group_payment_request` (defensive): the UPDATE now
--    targets only the single latest 'pending' row per `order_id`
--    (`distinct on (order_id) ... order by created_at desc`), so it's
--    correct regardless of how many stale duplicates exist. This is what
--    actually stops the crash.
--
-- 2. `begin_xendit_group_payment_attempt` and `begin_xendit_payment_attempt`
--    (root cause): before inserting a fresh 'pending' row, each now marks
--    any existing 'pending' row for the same (order/group, channel) with a
--    still-null `xendit_payment_request_id` as 'failed'
--    (`failure_reason = 'superseded_by_new_attempt'`). Safe unconditionally
--    -- a null request id means Xendit was never told this row exists, so
--    there is no live Xendit-side payment that could ever resolve to it.
--    Rows that already have a non-null request id are left untouched --
--    those are the action layer's responsibility
--    (`isStaleXenditAttempt`/`reconcileStaleXenditAttempt` in
--    `xendit-reconciliation.ts`, which inspects them against Xendit's own
--    status before deciding whether to treat them as abandoned). This
--    caps future accumulation at one live 'pending' row per
--    (order/group, channel) instead of growing without bound on every
--    retry.
--
-- Live data repair: none needed as a separate step -- applying this
-- migration doesn't touch existing rows, but the next real Pay Now click
-- for the affected group runs `begin_xendit_group_payment_attempt`, which
-- self-heals by superseding the existing orphaned duplicates per fix #2
-- before creating one fresh row, and fix #1 makes the subsequent finalize
-- succeed regardless.
--
-- ROLLBACK:
--   Restore the previous bodies from 20260927030000_group_payment_retry_partial.sql
--   (`begin_xendit_group_payment_attempt`, `finalize_xendit_group_payment_request`)
--   and 20260916140650_xendit_failed_payment_retry.sql (`begin_xendit_payment_attempt`).
-- =============================================================================

begin;

create or replace function public.begin_xendit_payment_attempt(
  p_order_id     uuid,
  p_channel_code text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'You must be signed in to start a payment' using errcode = '42501';
  end if;

  if p_channel_code not in ('GCASH', 'PAYMAYA', 'CARD') then
    raise exception 'Unsupported payment channel' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to pay for this order'
      using errcode = '42501';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'This order has been cancelled' using errcode = '22023';
  end if;

  if v_order.payment_status not in ('pending', 'failed') then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and payment_channel = p_channel_code
    and status = 'pending'
    and (
      (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
      or (xendit_payment_request_id is not null and expires_at is not null and expires_at > now())
      or (
        xendit_payment_request_id is not null and expires_at is null
        and payment_channel in ('GCASH', 'PAYMAYA')
        and created_at > now() - interval '20 minutes'
      )
      or (
        xendit_payment_request_id is not null and expires_at is null
        and payment_channel = 'CARD'
        and created_at > now() - interval '30 minutes'
      )
    )
  order by created_at desc
  limit 1
  for update;

  if found then
    return v_payment;
  end if;

  -- Root-cause fix: supersede any orphaned rows for this order/channel
  -- (already 'pending', but never reached Xendit -- null request id, and
  -- too old to be the live in-flight one just checked above) instead of
  -- letting them pile up untouched on every retry.
  update public.payments
  set status = 'failed',
      failure_reason = 'superseded_by_new_attempt'
  where order_id = p_order_id
    and payment_method_type = 'xendit'
    and payment_channel = p_channel_code
    and status = 'pending'
    and xendit_payment_request_id is null;

  insert into public.payments (
    order_id, payment_method_type, payment_channel, amount_cents, currency, status
  ) values (
    p_order_id, 'xendit', p_channel_code, v_order.total_cents, v_order.currency, 'pending'
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

create or replace function public.begin_xendit_group_payment_attempt(
  p_checkout_group_id uuid,
  p_channel_code       text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid                uuid := (select auth.uid());
  v_order               public.orders;
  v_result              public.payments;
  v_has_valid           boolean;
  v_eligible_order_ids  uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'You must be signed in to start a payment' using errcode = '42501';
  end if;

  if p_channel_code not in ('GCASH', 'PAYMAYA', 'CARD') then
    raise exception 'Unsupported payment channel' using errcode = '22023';
  end if;

  perform 1 from public.orders where checkout_group_id = p_checkout_group_id for update;
  if not found then
    raise exception 'Checkout group not found' using errcode = 'P0002';
  end if;

  for v_order in
    select * from public.orders where checkout_group_id = p_checkout_group_id for update
  loop
    if v_order.buyer_id <> v_uid then
      raise exception 'You do not have permission to pay for this order' using errcode = '42501';
    end if;

    if v_order.payment_status = 'paid' or v_order.order_status = 'cancelled' then
      continue;
    end if;

    if v_order.payment_status not in ('pending', 'failed') then
      raise exception 'This order is not awaiting payment' using errcode = '22023';
    end if;

    v_eligible_order_ids := array_append(v_eligible_order_ids, v_order.id);
  end loop;

  if array_length(v_eligible_order_ids, 1) is null then
    raise exception 'This group has already been paid' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.payments
    where checkout_group_id = p_checkout_group_id
      and payment_channel = p_channel_code
      and order_id = any(v_eligible_order_ids)
      and status = 'pending'
      and (
        (xendit_payment_request_id is null and created_at > now() - interval '2 minutes')
        or (xendit_payment_request_id is not null and expires_at is not null and expires_at > now())
        or (
          xendit_payment_request_id is not null and expires_at is null
          and payment_channel in ('GCASH', 'PAYMAYA')
          and created_at > now() - interval '20 minutes'
        )
        or (
          xendit_payment_request_id is not null and expires_at is null
          and payment_channel = 'CARD'
          and created_at > now() - interval '30 minutes'
        )
      )
  ) into v_has_valid;

  if not v_has_valid then
    -- Root-cause fix: same superseding as begin_xendit_payment_attempt
    -- above, scoped to the orders about to get a fresh row. This is what
    -- keeps at most one live 'pending' row per (order, channel), which is
    -- what makes finalize_xendit_group_payment_request's per-order UPDATE
    -- safe against the unique constraint on retry.
    update public.payments
    set status = 'failed',
        failure_reason = 'superseded_by_new_attempt'
    where checkout_group_id = p_checkout_group_id
      and payment_channel = p_channel_code
      and status = 'pending'
      and xendit_payment_request_id is null
      and order_id = any(v_eligible_order_ids);

    insert into public.payments (
      order_id, payment_method_type, payment_channel, amount_cents, currency, status, checkout_group_id
    )
    select o.id, 'xendit', p_channel_code, o.total_cents, o.currency, 'pending', p_checkout_group_id
    from public.orders o
    where o.checkout_group_id = p_checkout_group_id
      and o.id = any(v_eligible_order_ids);
  end if;

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code
    and order_id = any(v_eligible_order_ids)
  order by created_at desc
  limit 1;

  return v_result;
end;
$$;

create or replace function public.finalize_xendit_group_payment_request(
  p_checkout_group_id         uuid,
  p_channel_code               text,
  p_xendit_payment_request_id text,
  p_checkout_url               text,
  p_expires_at                 timestamptz default null,
  p_status                     text default 'pending'
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_result public.payments;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  perform 1 from public.payments
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code
    and status = 'pending'
  for update;
  if not found then
    raise exception 'Payment group not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.payments p join public.orders o on o.id = p.order_id
    where p.checkout_group_id = p_checkout_group_id
      and p.payment_channel = p_channel_code
      and o.buyer_id <> v_uid
  ) then
    raise exception 'You do not have permission to modify this payment' using errcode = '42501';
  end if;

  -- Defensive fix: target exactly one row per order_id -- the latest
  -- 'pending' one -- instead of every row matching the broad
  -- (checkout_group_id, payment_channel, status='pending') filter. If any
  -- stale duplicate 'pending' rows exist for an order (should no longer
  -- happen going forward per begin_xendit_group_payment_attempt's
  -- superseding fix, but this makes finalize correct even if they do),
  -- setting more than one of them to the same xendit_payment_request_id in
  -- one UPDATE violates payments_xendit_payment_request_id_key (UNIQUE
  -- (xendit_payment_request_id, order_id)) -- reproduced live before this
  -- fix, against checkout_group_id 7ea6face-906b-43fb-b395-61884b53a3ed.
  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where id in (
    select distinct on (order_id) id
    from public.payments
    where checkout_group_id = p_checkout_group_id
      and payment_channel = p_channel_code
      and status = 'pending'
    order by order_id, created_at desc
  );

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code
  order by updated_at desc
  limit 1;

  return v_result;
end;
$$;

commit;
