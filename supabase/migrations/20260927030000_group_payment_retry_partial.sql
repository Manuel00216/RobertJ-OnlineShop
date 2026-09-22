-- =============================================================================
-- Xendit payment recovery, step F (final): make a multi-seller checkout
-- group's payment retry per-member instead of all-or-nothing.
--
-- Today, `begin_xendit_group_payment_attempt` loops over every order sharing
-- a `checkout_group_id` and raises if *any* member's `payment_status` isn't
-- 'pending'/'failed'. Once one seller's order in the group reaches 'paid',
-- retrying for the group is blocked forever -- no path exists to pay for
-- just the remaining unpaid order(s). Confirmed live: a real checkout group
-- with one 'paid' order (1 payment row), one 'failed' order (2 payment
-- rows), and one 'pending' order (0 payment rows) -- the 'pending' order's
-- retry is impossible because its sibling is already paid.
--
-- Three functions change, all in the same group-retry code path:
--
-- 1. `begin_xendit_group_payment_attempt`: skips (doesn't reject) members
--    that are already 'paid' or whose order is 'cancelled'; only
--    'pending'/'failed' members become "eligible". If zero members are
--    eligible, it still raises the existing "already been paid" error --
--    same observable behavior for the fully-resolved case, just reached via
--    a different path. The idempotent reuse-check and the new-row insert
--    are both scoped to the eligible subset only.
--
-- 2. `finalize_xendit_group_payment_request`: its UPDATE previously matched
--    every payments row for `(checkout_group_id, payment_channel)` with no
--    status filter -- for a partial-group retry this silently overwrote an
--    already-paid sibling's `xendit_payment_request_id`/`checkout_url`/
--    `expires_at` with the new attempt's values, corrupting that sibling's
--    payment record (audit trail, and anything keyed off its provider id,
--    e.g. refunds). Now scoped to `status = 'pending'` -- only the rows this
--    attempt just reserved.
--
-- 3. `process_xendit_webhook`'s group branch had three bugs, found while
--    re-verifying it per the audit's own flag ("must be re-verified once
--    the reservation side changes, since it's the piece that reconciles
--    the new partial charge back into per-order status"):
--      a. The reference-mismatch guard compared `xendit_payment_request_id`
--         against *every* row in the group, including an already-paid
--         sibling's historically-different id -- which would always trip
--         'reference_mismatch' and permanently block the webhook for any
--         group with a paid member. Scoped to `status = 'pending'`.
--      b. `v_group_total` summed `amount_cents` over *every* row in the
--         group, including an already-paid sibling's row -- overcharging
--         the amount-mismatch check by exactly that sibling's total.
--         Scoped to `status = 'pending'`, matching the actual amount Xendit
--         charges for a partial-group attempt.
--      c. The per-member resolution loop matched every non-final payment
--         row for the checkout group with no channel filter -- pre-existing,
--         not introduced by this migration, but confirmed live (via a
--         rolled-back transaction against ORD-20260914-000131, which
--         carries exactly this shape) and made easier to hit now that
--         partial-group retries actually reach a real webhook instead of
--         being permanently blocked. A buyer who starts one channel,
--         abandons it, and pays via another channel leaves a stale
--         `pending` row on the abandoned channel with no
--         `xendit_payment_request_id` (never finalized, never charged);
--         the loop would mark that row `paid` too, alongside the row that
--         was actually charged. Scoped to
--         `p_channel_code is null or p.payment_channel = p_channel_code`
--         (falls back to the old unscoped behavior only on the rare event
--         where Xendit's payload omits `channel_code`, matching what the
--         webhook route already tolerates -- see `p_channel_code ?? undefined`
--         in `src/app/api/webhooks/xendit/route.ts`).
--    The single-order branch is unchanged.
--
-- `getXenditGroupPaymentTotal` (src/lib/supabase/queries.ts) has the same
-- unconditional-sum bug and is fixed in the same change as this migration,
-- outside SQL -- see that function's updated comment.
--
-- ROLLBACK:
--   Restore the previous bodies:
--   - `begin_xendit_group_payment_attempt` and `finalize_xendit_group_payment_request`
--     from 20260916140650_xendit_failed_payment_retry.sql and
--     20260905155705_xendit_webhook_audit_and_rpcs.sql respectively (mind
--     later signature-preserving tweaks in between -- diff against live
--     `pg_get_functiondef` before restoring).
--   - `process_xendit_webhook` from 20260915101406_xendit_phase2_channel_scoped_group_finalize.sql.
-- =============================================================================

begin;

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

    -- A member that's already paid, or whose order was cancelled, is no
    -- longer part of this attempt -- skip it instead of blocking the whole
    -- group's retry.
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

  -- Reuse-check and insert are both scoped to the eligible subset only --
  -- an already-paid sibling never gets a second payments row.
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

  -- Scoped to still-pending rows -- the ones this specific attempt just
  -- reserved via begin_xendit_group_payment_attempt.
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

  -- Scoped to `status = 'pending'` -- an already-paid or already-failed
  -- sibling's row from an earlier attempt must never be overwritten with
  -- this attempt's xendit_payment_request_id/checkout_url/expires_at.
  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code
    and status = 'pending';

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code
  order by updated_at desc
  limit 1;

  return v_result;
end;
$$;

create or replace function public.process_xendit_webhook(
  p_reference_id               uuid,
  p_xendit_payment_request_id  text,
  p_xendit_payment_id          text,
  p_status                     text,
  p_amount_cents                integer,
  p_currency                    text,
  p_raw_payload                 jsonb,
  p_channel_code                text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment     public.payments;
  v_order       public.orders;
  v_new_status  public.payment_status;
  v_is_group    boolean;
  v_all_final   boolean;
  v_group_total integer;
  v_group_ccy   text;
  v_member      record;
  v_result      public.payments;
begin
  select exists(select 1 from public.payments where checkout_group_id = p_reference_id) into v_is_group;

  if v_is_group then
    -- Card exception mirrors the single-payment branch below: a Card
    -- payment's underlying payment_request id (webhook's p_xendit_payment_request_id,
    -- "pr-...") legitimately differs from the Card session id stored on the
    -- payments rows ("ps-...", set by finalize_xendit_group_payment_request).
    -- Without this exception every Card group webhook is wrongly rejected as
    -- reference_mismatch and the group is stuck pending forever.
    --
    -- Scoped to `status = 'pending'`: an already-paid/failed sibling from an
    -- earlier, separate attempt naturally carries a different
    -- xendit_payment_request_id and must not trip this guard for the
    -- current attempt's still-pending rows.
    if exists (
      select 1 from public.payments
      where checkout_group_id = p_reference_id
        and status = 'pending'
        and payment_channel <> 'CARD'
        and xendit_payment_request_id is distinct from p_xendit_payment_request_id
    ) then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'reference_mismatch', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    select bool_and(status in ('paid', 'failed')) into v_all_final
    from public.payments where checkout_group_id = p_reference_id;

    if v_all_final then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'duplicate_or_late', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    -- Scoped to `status = 'pending'`: summing unconditionally over every
    -- historical row -- including an already-paid sibling's row from an
    -- earlier, separate attempt -- would overcharge the amount-mismatch
    -- check by exactly that sibling's total. Only this attempt's
    -- still-pending rows represent what Xendit is actually charging now.
    select sum(amount_cents), max(currency) into v_group_total, v_group_ccy
    from public.payments where checkout_group_id = p_reference_id and status = 'pending';

    if p_amount_cents is distinct from v_group_total or p_currency is distinct from v_group_ccy then
      update public.payments
      set status = 'failed',
          failure_reason = 'amount_mismatch',
          payment_channel = coalesce(p_channel_code, payment_channel),
          xendit_payment_id = p_xendit_payment_id,
          provider_response = p_raw_payload,
          verified_at = now()
      where checkout_group_id = p_reference_id and status = 'pending';

      update public.orders o set payment_status = 'failed'
      from public.payments p
      where p.order_id = o.id and p.checkout_group_id = p_reference_id and o.payment_status = 'pending';

      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'amount_mismatch', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    v_new_status := case
      when p_status = 'SUCCEEDED' then 'paid'::public.payment_status
      when p_status in ('FAILED', 'EXPIRED', 'CANCELED') then 'failed'::public.payment_status
      else null
    end;

    if v_new_status is null then
      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, null, 'ignored_transient_status', p_raw_payload
      );
      select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
      return v_result;
    end if;

    -- Channel-scoped: a stale, never-charged `pending` row on a different,
    -- abandoned channel (the buyer started GCash, abandoned it, then paid
    -- via Maya) must never be swept up and marked resolved by this
    -- specific channel's webhook. Falls back to unscoped only if Xendit's
    -- payload omitted channel_code (rare -- the webhook route already
    -- tolerates that as `data.channel_code ?? undefined`).
    for v_member in
      select p.id as payment_id, p.status as payment_status, o.id as order_id, o.order_status
      from public.payments p join public.orders o on o.id = p.order_id
      where p.checkout_group_id = p_reference_id
        and (p_channel_code is null or p.payment_channel = p_channel_code)
      for update of p, o
    loop
      if v_member.payment_status in ('paid', 'failed') then
        insert into public.payment_webhook_events (
          xendit_payment_request_id, xendit_payment_id, reference_id,
          event_type, status, payment_row_id, processing_result, raw_payload
        ) values (
          p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
          'payment', p_status, v_member.payment_id, 'duplicate_or_late', p_raw_payload
        );
        continue;
      end if;

      if v_member.order_status = 'cancelled' then
        insert into public.payment_webhook_events (
          xendit_payment_request_id, xendit_payment_id, reference_id,
          event_type, status, payment_row_id, processing_result, raw_payload
        ) values (
          p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
          'payment', p_status, v_member.payment_id, 'order_cancelled', p_raw_payload
        );
        continue;
      end if;

      update public.payments
      set status = v_new_status,
          payment_channel = coalesce(p_channel_code, payment_channel),
          xendit_payment_request_id = coalesce(p_xendit_payment_request_id, xendit_payment_request_id),
          xendit_payment_id = p_xendit_payment_id,
          failure_reason = case when v_new_status = 'failed' then 'xendit_status:' || p_status else null end,
          provider_response = p_raw_payload,
          verified_at = now()
      where id = v_member.payment_id;

      update public.orders set payment_status = v_new_status where id = v_member.order_id;

      insert into public.payment_webhook_events (
        xendit_payment_request_id, xendit_payment_id, reference_id,
        event_type, status, payment_row_id, processing_result, raw_payload
      ) values (
        p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
        'payment', p_status, v_member.payment_id, 'applied', p_raw_payload
      );
    end loop;

    select * into v_result from public.payments where checkout_group_id = p_reference_id limit 1;
    return v_result;
  end if;

  select * into v_payment
  from public.payments
  where id = p_reference_id
  for update;

  if not found then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, null, 'unknown_reference', p_raw_payload
    );
    return null;
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_payment.payment_channel <> 'CARD'
     and v_payment.xendit_payment_request_id is distinct from p_xendit_payment_request_id
  then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'reference_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  if v_payment.status in ('paid', 'failed') then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'duplicate_or_late', p_raw_payload
    );
    return v_payment;
  end if;

  if v_order.order_status = 'cancelled' then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'order_cancelled', p_raw_payload
    );
    return v_payment;
  end if;

  if p_amount_cents is distinct from v_payment.amount_cents
     or p_currency is distinct from v_payment.currency
  then
    update public.payments
    set status = 'failed',
        failure_reason = 'amount_mismatch',
        payment_channel = coalesce(p_channel_code, payment_channel),
        xendit_payment_id = p_xendit_payment_id,
        provider_response = p_raw_payload,
        verified_at = now()
    where id = v_payment.id
    returning * into v_payment;

    update public.orders set payment_status = 'failed' where id = v_order.id;

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'amount_mismatch', p_raw_payload
    );
    return v_payment;
  end if;

  v_new_status := case
    when p_status = 'SUCCEEDED' then 'paid'::public.payment_status
    when p_status in ('FAILED', 'EXPIRED', 'CANCELED') then 'failed'::public.payment_status
    else null
  end;

  if v_new_status is null then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id,
      event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
      'payment', p_status, v_payment.id, 'ignored_transient_status', p_raw_payload
    );
    return v_payment;
  end if;

  update public.payments
  set status = v_new_status,
      payment_channel = coalesce(p_channel_code, payment_channel),
      xendit_payment_request_id = coalesce(p_xendit_payment_request_id, xendit_payment_request_id),
      xendit_payment_id = p_xendit_payment_id,
      failure_reason = case when v_new_status = 'failed' then 'xendit_status:' || p_status else null end,
      provider_response = p_raw_payload,
      verified_at = now()
  where id = v_payment.id
  returning * into v_payment;

  update public.orders set payment_status = v_new_status where id = v_order.id;

  insert into public.payment_webhook_events (
    xendit_payment_request_id, xendit_payment_id, reference_id,
    event_type, status, payment_row_id, processing_result, raw_payload
  ) values (
    p_xendit_payment_request_id, p_xendit_payment_id, p_reference_id,
    'payment', p_status, v_payment.id, 'applied', p_raw_payload
  );

  return v_payment;
end;
$$;

commit;
