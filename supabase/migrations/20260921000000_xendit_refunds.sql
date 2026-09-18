-- =============================================================================
-- Phase 5B: real Xendit refunds for GCash/Maya/Card, layered on top of
-- Phase 5A's cumulative partial/full refund bookkeeping (20260920000000).
--
-- Verified beforehand (Phase 5B-1 spike, Test Mode, read-only against our own
-- DB/no code changes):
--  * All three channels resolve to the SAME identifier once a payment is
--    genuinely 'paid': payments.xendit_payment_request_id. Card's session id
--    (ps-...) is only ever visible on rows still 'pending' (never webhook-
--    confirmed) -- process_xendit_webhook already overwrites it with the
--    real Payment Request ID (pr-...) the moment a Card payment succeeds, via
--    its existing `coalesce(p_xendit_payment_request_id, xendit_payment_request_id)`.
--    No Card-specific branching is needed anywhere in this migration.
--  * POST /refunds is asynchronous: Xendit's own docs say "Refund is
--    pending. Check the final status of the refund via webhook." Even though
--    Test Mode was observed returning status: SUCCEEDED synchronously, this
--    migration never treats that as authoritative -- only
--    process_xendit_refund_webhook (below) ever moves a refund to
--    'succeeded'/'failed', mirroring process_xendit_webhook's own
--    "webhook is the sole authority" rule for payments.
--  * The idempotency header Xendit's /refunds endpoint actually honors is
--    `Idempotency-Key` (verified live: two calls with `X-IDEMPOTENCY-KEY`
--    created two separate refunds; two calls with `Idempotency-Key`
--    returned the identical refund object both times) -- the exact same
--    header name/mechanism xenditFetch already uses for payment creation.
--
-- Design, deliberately minimal:
--  * One new table, xendit_refunds -- one row per refund ATTEMPT (a failed
--    attempt can be retried, producing a second row for the same
--    return_request). Admin-read-only via RLS (mirrors return_requests'
--    three-way buyer/seller/admin ownership check, joined through
--    return_request_id since a refund attempt has no buyer_id of its own).
--    RPC-only writes, no INSERT/UPDATE/DELETE grant to anyone -- matches the
--    payments/return_requests/stock_adjustments precedent exactly.
--  * No new payment_status or return_status value. "Refund submitted, not
--    yet confirmed" is represented by decide_return leaving
--    return_requests.status exactly where it was (seller_accepted/
--    seller_rejected) and creating a 'pending' xendit_refunds row instead --
--    the app layer surfaces that row's existence as the explicit "pending"
--    signal (Phase 5B requirement: never treat pending as refunded). This
--    also means a failed refund needs zero cleanup/revert on
--    return_requests: it was never moved away from seller_accepted/
--    seller_rejected in the first place, so a retry is just calling
--    decide_return('approve') again.
--  * decide_return (approve branch) now branches on
--    v_payment.payment_method_type:
--      - anything other than 'xendit' (COD, and any retired qr_upload/card
--        legacy row): byte-for-byte the exact Phase 5A body -- immediate
--        finalize, no gateway involved, unchanged behavior.
--      - 'xendit': validates (no refund already in flight for this request;
--        cumulative already-succeeded xendit_refunds + this request's
--        amount must not exceed payments.amount_cents -- the exact same
--        over-refund guard Phase 5A already had, just sourced from
--        xendit_refunds instead of return_requests since that's now the
--        authoritative ledger for Xendit orders), then inserts one 'pending'
--        xendit_refunds row and records the admin's decision fields.
--        payments/orders/return_requests status is NOT touched here --
--        provider confirmation (the webhook) is what actually finalizes it,
--        kept deliberately separate from this internal approval step.
--  * Two small app-layer recording RPCs (called from the Server Action right
--    after it calls Xendit, mirroring finalize_xendit_payment_request's
--    "narrow, no business logic" shape): record_xendit_refund_submission
--    (store the returned refund id + raw response, stays 'pending') and
--    fail_xendit_refund_submission (the outbound HTTP call itself never got
--    a response at all -- mark 'failed' immediately, nothing to wait for).
--  * process_xendit_refund_webhook: service_role only (revoked from
--    public/anon/authenticated, exactly like process_xendit_webhook), the
--    sole path from 'pending' to 'succeeded'/'failed'. Idempotent: looks up
--    by xendit_refund_id with a row lock, no-ops (logs duplicate_or_late) if
--    already terminal. On succeeded, applies the exact same
--    partially_refunded/refunded branch Phase 5A already has, now summing
--    xendit_refunds.amount_cents instead of return_requests.refund_amount_cents,
--    and flips the owning return_request to 'refunded'. On failed,
--    payments/orders/return_requests are left completely alone.
--  * Every webhook delivery (applied, duplicate, unknown reference, amount
--    mismatch, transient/unrecognized status) is logged to the existing
--    payment_webhook_events table with event_type = 'refund' -- reused
--    rather than duplicating a second audit-log table, since its shape
--    (reference_id/payment_row_id/processing_result/raw_payload) already
--    fits a refund delivery as well as a payment one.
--
-- Deliberately NOT done here: no change to request_return, respond_to_return,
-- cancelBuyerOrder, advanceOrderStatus, enforce_order_update_rules,
-- process_xendit_webhook, mark_cod_payment_collected, or any Phase 1-4
-- Xendit payment-creation code. COD's decide_return path is untouched
-- (it's the "else" branch, byte-identical to Phase 5A).
--
-- ROLLBACK:
--   revoke all on function public.process_xendit_refund_webhook(text, text, text, integer, jsonb) from service_role;
--   drop function public.process_xendit_refund_webhook(text, text, text, integer, jsonb);
--   drop function public.fail_xendit_refund_submission(uuid, text);
--   drop function public.record_xendit_refund_submission(uuid, text, jsonb);
--   -- restore decide_return's body from 20260920000000_returns_paid_cancelled_and_partial_refund.sql
--   drop table public.xendit_refunds;
--   drop type public.xendit_refund_status;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- xendit_refunds
-- -----------------------------------------------------------------------------
create type public.xendit_refund_status as enum ('pending', 'succeeded', 'failed');

create table public.xendit_refunds (
  id                          uuid primary key default gen_random_uuid(),
  return_request_id          uuid not null references public.return_requests (id),
  payment_id                  uuid not null references public.payments (id),
  xendit_payment_request_id   text not null,
  xendit_refund_id            text unique,
  amount_cents                integer not null check (amount_cents > 0),
  currency                    text not null,
  status                      public.xendit_refund_status not null default 'pending',
  failure_code                text,
  raw_response                jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table public.xendit_refunds is
  'One row per Xendit refund attempt approved via decide_return. A failed attempt can be retried, producing another row for the same return_request. RPC-only writes: decide_return (insert, pending), record_xendit_refund_submission / fail_xendit_refund_submission (app layer after calling Xendit), process_xendit_refund_webhook (service_role only, sole path to succeeded/failed).';

create index xendit_refunds_return_request_id_idx on public.xendit_refunds (return_request_id);
create index xendit_refunds_payment_id_idx on public.xendit_refunds (payment_id);

create trigger xendit_refunds_set_updated_at
  before update on public.xendit_refunds
  for each row execute function public.set_updated_at();

alter table public.xendit_refunds enable row level security;

create policy "buyers sellers and admins read their refund attempts"
  on public.xendit_refunds for select
  to authenticated
  using (
    exists (
      select 1 from public.return_requests rr
      where rr.id = xendit_refunds.return_request_id
        and (rr.buyer_id = (select auth.uid()) or rr.seller_id = (select auth.uid()) or public.is_admin())
    )
  );

grant select on public.xendit_refunds to authenticated;
-- No insert/update/delete grant -- matches payments/return_requests: every
-- write goes through the RPCs below.


-- -----------------------------------------------------------------------------
-- decide_return: approve branch now splits COD (and any other non-xendit
-- payment_method_type) from Xendit. Reject path is byte-for-byte unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.decide_return(
  p_return_id uuid,
  p_decision  text,
  p_note      text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := (select auth.uid());
  v_request          public.return_requests;
  v_order            public.orders;
  v_payment          public.payments;
  v_refund_amount    integer;
  v_already_refunded integer;
  v_total_refunded   integer;
  v_new_status       public.payment_status;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to decide a return request'
      using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found' using errcode = 'P0002';
  end if;

  if v_request.status not in ('seller_accepted', 'seller_rejected') then
    raise exception 'This return request is not ready for a final decision'
      using errcode = '23514';
  end if;

  if p_decision = 'reject' then
    update public.return_requests
    set status = 'admin_rejected',
        admin_decision_note = p_note,
        admin_decided_at = now(),
        admin_decided_by = v_uid
    where id = p_return_id
    returning * into v_request;

    insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
    values (
      v_uid, 'reject_refund', v_request.buyer_id,
      jsonb_build_object('return_id', p_return_id, 'order_id', v_request.order_id)
    );

    return v_request;
  end if;

  -- p_decision = 'approve'.
  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select * into v_payment
  from public.payments
  where order_id = v_request.order_id and status in ('paid', 'partially_refunded')
  for update;
  if not found then
    raise exception 'No paid payment found for this order' using errcode = '23514';
  end if;

  -- Unchanged: order total for a whole-order return, that item's own
  -- subtotal_cents for an item-level one.
  if v_request.order_item_id is null then
    v_refund_amount := v_order.total_cents;
  else
    select subtotal_cents into v_refund_amount
    from public.order_items
    where id = v_request.order_item_id;
  end if;

  if v_payment.payment_method_type <> 'xendit' then
    -- Phase 5A, byte-for-byte: no gateway to call (COD, or a retired
    -- qr_upload/card legacy row) -- admin approval and the refund are the
    -- same atomic event.
    select coalesce(sum(refund_amount_cents), 0) into v_already_refunded
    from public.return_requests
    where order_id = v_request.order_id and status = 'refunded';

    v_total_refunded := v_already_refunded + v_refund_amount;

    if v_total_refunded > v_payment.amount_cents then
      raise exception 'This refund would exceed the amount actually paid for this order'
        using errcode = '23514';
    end if;

    v_new_status := case
      when v_total_refunded < v_payment.amount_cents then 'partially_refunded'::public.payment_status
      else 'refunded'::public.payment_status
    end;

    update public.payments set status = v_new_status where id = v_payment.id;

    perform set_config('app.refund_in_progress', 'true', true);

    update public.orders set payment_status = v_new_status where id = v_order.id;

    update public.return_requests
    set status = 'refunded',
        admin_decision_note = p_note,
        admin_decided_at = now(),
        admin_decided_by = v_uid,
        refund_amount_cents = v_refund_amount
    where id = p_return_id
    returning * into v_request;

    insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
    values (
      v_uid, 'approve_refund', v_request.buyer_id,
      jsonb_build_object(
        'return_id', p_return_id, 'order_id', v_request.order_id,
        'refund_amount_cents', v_refund_amount,
        'payment_status', v_new_status
      )
    );

    return v_request;
  end if;

  -- Xendit-paid: submit an async refund instead of finalizing immediately.
  -- payments/orders/return_requests status is intentionally NOT changed
  -- here -- process_xendit_refund_webhook is the only thing that can move
  -- this to succeeded/failed, keeping provider confirmation separate from
  -- this internal approval step.
  if v_payment.xendit_payment_request_id is null then
    raise exception 'This payment has no Xendit reference to refund' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.xendit_refunds
    where return_request_id = p_return_id and status = 'pending'
  ) then
    raise exception 'A refund is already being processed for this request' using errcode = '23514';
  end if;

  select coalesce(sum(amount_cents), 0) into v_already_refunded
  from public.xendit_refunds
  where payment_id = v_payment.id and status = 'succeeded';

  v_total_refunded := v_already_refunded + v_refund_amount;

  if v_total_refunded > v_payment.amount_cents then
    raise exception 'This refund would exceed the amount actually paid for this order'
      using errcode = '23514';
  end if;

  insert into public.xendit_refunds (
    return_request_id, payment_id, xendit_payment_request_id, amount_cents, currency, status
  ) values (
    p_return_id, v_payment.id, v_payment.xendit_payment_request_id, v_refund_amount, v_payment.currency, 'pending'
  );

  update public.return_requests
  set admin_decision_note = p_note,
      admin_decided_at = now(),
      admin_decided_by = v_uid
  where id = p_return_id
  returning * into v_request;

  insert into public.admin_action_log (actor_id, action, target_user_id, metadata)
  values (
    v_uid, 'approve_refund', v_request.buyer_id,
    jsonb_build_object(
      'return_id', p_return_id, 'order_id', v_request.order_id,
      'refund_amount_cents', v_refund_amount,
      'status', 'submitted_to_xendit'
    )
  );

  return v_request;
end;
$$;

comment on function public.decide_return is
  'Admin-only: approves (executes or submits the refund) or rejects a return request already responded to by its seller. Only valid from seller_accepted/seller_rejected. COD/legacy payments finalize immediately (partially_refunded/refunded, same cumulative guard as before). Xendit payments instead create a pending xendit_refunds row and leave return_requests/payments/orders untouched until process_xendit_refund_webhook confirms the outcome.';


-- -----------------------------------------------------------------------------
-- record_xendit_refund_submission: admin-only, called by the app layer right
-- after Xendit's synchronous API response comes back (whatever status it
-- reports -- never trusted as final). Purely records facts; status stays
-- 'pending'.
-- -----------------------------------------------------------------------------
create or replace function public.record_xendit_refund_submission(
  p_refund_id        uuid,
  p_xendit_refund_id text,
  p_raw_response     jsonb
)
returns public.xendit_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_refund public.xendit_refunds;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to record a refund submission' using errcode = '42501';
  end if;

  select * into v_refund from public.xendit_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund attempt not found' using errcode = 'P0002';
  end if;
  if v_refund.status <> 'pending' then
    raise exception 'This refund attempt is no longer pending' using errcode = '23514';
  end if;

  update public.xendit_refunds
  set xendit_refund_id = p_xendit_refund_id,
      raw_response = p_raw_response
  where id = p_refund_id
  returning * into v_refund;

  return v_refund;
end;
$$;

comment on function public.record_xendit_refund_submission is
  'Records the Xendit refund id + raw response once the API call returns. Never changes status away from pending -- process_xendit_refund_webhook is the sole path to succeeded/failed.';

revoke all on function public.record_xendit_refund_submission(uuid, text, jsonb) from public, anon;
grant execute on function public.record_xendit_refund_submission(uuid, text, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- fail_xendit_refund_submission: admin-only, for when the outbound call to
-- Xendit itself never got a response at all (network/HTTP error). Marks the
-- attempt failed immediately -- there is no webhook to wait for. Nothing on
-- return_requests needs reverting: decide_return never moved it away from
-- seller_accepted/seller_rejected, so a retry is just approving again.
-- -----------------------------------------------------------------------------
create or replace function public.fail_xendit_refund_submission(
  p_refund_id  uuid,
  p_error_note text
)
returns public.xendit_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_refund public.xendit_refunds;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'You do not have permission to update this refund attempt' using errcode = '42501';
  end if;

  select * into v_refund from public.xendit_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund attempt not found' using errcode = 'P0002';
  end if;
  if v_refund.status <> 'pending' then
    raise exception 'This refund attempt is no longer pending' using errcode = '23514';
  end if;

  update public.xendit_refunds
  set status = 'failed',
      failure_code = 'submission_error',
      raw_response = jsonb_build_object('error', p_error_note)
  where id = p_refund_id
  returning * into v_refund;

  return v_refund;
end;
$$;

comment on function public.fail_xendit_refund_submission is
  'The outbound POST /refunds call itself failed (no Xendit refund id was ever returned) -- marks the attempt failed immediately so the admin can safely retry via decide_return.';

revoke all on function public.fail_xendit_refund_submission(uuid, text) from public, anon;
grant execute on function public.fail_xendit_refund_submission(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- process_xendit_refund_webhook: service_role only, the sole path from
-- 'pending' to 'succeeded'/'failed'. Idempotent against retries/duplicates/
-- out-of-order delivery, same shape as process_xendit_webhook.
-- -----------------------------------------------------------------------------
create or replace function public.process_xendit_refund_webhook(
  p_xendit_refund_id text,
  p_status            text,
  p_failure_code      text,
  p_amount_cents      integer,
  p_raw_payload       jsonb
)
returns public.xendit_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund         public.xendit_refunds;
  v_payment        public.payments;
  v_order          public.orders;
  v_new_status     public.payment_status;
  v_total_refunded integer;
begin
  select * into v_refund from public.xendit_refunds where xendit_refund_id = p_xendit_refund_id for update;

  if not found then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      null, null, null, 'refund', p_status, null, 'unknown_refund_reference', p_raw_payload
    );
    return null;
  end if;

  if v_refund.status <> 'pending' then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'duplicate_or_late', p_raw_payload
    );
    return v_refund;
  end if;

  -- Defensive amount cross-check, same spirit as process_xendit_webhook's
  -- amount-mismatch guard: never silently apply a refund for a different
  -- amount than what was actually submitted.
  if p_amount_cents is not null and p_amount_cents <> 0 and p_amount_cents is distinct from v_refund.amount_cents then
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'refund_amount_mismatch', p_raw_payload
    );
    return v_refund;
  end if;

  if p_status = 'SUCCEEDED' then
    select * into v_payment from public.payments where id = v_refund.payment_id for update;
    select * into v_order from public.orders where id = v_payment.order_id for update;

    update public.xendit_refunds
    set status = 'succeeded', raw_response = p_raw_payload
    where id = v_refund.id;

    select coalesce(sum(amount_cents), 0) into v_total_refunded
    from public.xendit_refunds
    where payment_id = v_payment.id and status = 'succeeded';

    -- Defensive only: decide_return already validates this at submission
    -- time, so cumulative should never exceed the paid amount here. Cap at
    -- 'refunded' rather than leave an inconsistent state, and flag it.
    v_new_status := case
      when v_total_refunded < v_payment.amount_cents then 'partially_refunded'::public.payment_status
      else 'refunded'::public.payment_status
    end;

    update public.payments set status = v_new_status where id = v_payment.id;

    perform set_config('app.refund_in_progress', 'true', true);

    update public.orders set payment_status = v_new_status where id = v_order.id;

    update public.return_requests
    set status = 'refunded',
        refund_amount_cents = v_refund.amount_cents
    where id = v_refund.return_request_id;

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id,
      case when v_total_refunded > v_payment.amount_cents then 'refund_overshoot_anomaly' else 'applied' end,
      p_raw_payload
    );

  elsif p_status in ('FAILED', 'CANCELLED') then
    update public.xendit_refunds
    set status = 'failed', failure_code = p_failure_code, raw_response = p_raw_payload
    where id = v_refund.id;
    -- return_requests/payments/orders intentionally untouched -- still
    -- exactly where they were before this attempt, safe to retry.

    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'applied', p_raw_payload
    );
  else
    -- PENDING or an unrecognized status -- never safe to assume an outcome.
    insert into public.payment_webhook_events (
      xendit_payment_request_id, xendit_payment_id, reference_id, event_type, status, payment_row_id, processing_result, raw_payload
    ) values (
      v_refund.xendit_payment_request_id, p_xendit_refund_id, v_refund.id, 'refund', p_status, v_refund.payment_id, 'ignored_transient_status', p_raw_payload
    );
  end if;

  select * into v_refund from public.xendit_refunds where id = v_refund.id;
  return v_refund;
end;
$$;

comment on function public.process_xendit_refund_webhook is
  'service_role ONLY. Sole path from a pending xendit_refunds row to succeeded/failed. Idempotent against duplicate/out-of-order webhook delivery. On succeeded, applies the same cumulative partially_refunded/refunded logic decide_return uses for COD, sourced from xendit_refunds instead of return_requests, and flips the owning return_request to refunded. On failed, payments/orders/return_requests are left untouched so decide_return can be safely retried.';

revoke all on function public.process_xendit_refund_webhook(text, text, text, integer, jsonb) from public, anon, authenticated;
-- No explicit grant to authenticated -- service_role bypasses grants
-- entirely, same as process_xendit_webhook.

commit;
