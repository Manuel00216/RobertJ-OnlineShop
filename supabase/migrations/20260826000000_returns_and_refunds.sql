-- =============================================================================
-- Returns & Refunds (Admin Center Phase 2): the buyer → seller → admin
-- lifecycle for a post-delivery return/refund request, and the sole path
-- that can ever move a payment/order to a refunded state.
--
-- Design, deliberately narrow:
--  * State machine, 5 values (simplified from an earlier 6-value draft —
--    there is no payment gateway to wait on settlement from, so an admin's
--    approval and the refund itself are the same atomic event, not two
--    separate states):
--        pending -> seller_accepted -> refunded
--        pending -> seller_accepted -> admin_rejected
--        pending -> seller_rejected -> refunded   (admin overrules the seller)
--        pending -> seller_rejected -> admin_rejected
--    Every transition is validated inside the RPC that performs it — never
--    left to the UI, never a bare client UPDATE (no INSERT/UPDATE grant on
--    the table at all, matching the `payments`/`stock_adjustments`
--    RPC-only precedent).
--  * `return_requests` references an existing `orders` row (must already be
--    `delivered`) and optionally one `order_items` row (null = whole-order
--    return). `seller_id` is a snapshot at creation, same denormalization
--    `inventory`/`stock_adjustments` already use, so RLS can scope with a
--    direct column comparison instead of a join on every read.
--  * No new "payment event" model: on refund, `decide_return` updates the
--    **existing** `paid` `payments` row to `refunded` and mirrors
--    `orders.payment_status` — the exact dual-write `verify_payment`
--    already does for `paid`/`failed`. `refund_amount_cents` is captured
--    on `return_requests` itself (order total for a whole-order return,
--    that item's `subtotal_cents` for an item-level one).
--  * Duplicate-request prevention is DB-enforced, not just app-checked: a
--    partial unique index blocks more than one open (`pending`/
--    `seller_accepted`) request per order/item combination — closes the
--    check-then-insert race a plain app-level SELECT-before-INSERT can't.
--  * Duplicate-refund prevention: `decide_return` only accepts a request
--    currently in `seller_accepted` or `seller_rejected` (locked `for
--    update` first) — a request already `refunded` or `admin_rejected` is
--    rejected outright, and the row lock serializes any concurrent
--    double-click/double-submit into one winner.
--  * Closes a gap found while designing this migration: `orders`' own
--    `enforce_order_update_rules` trigger unconditionally bypasses every
--    check for `is_admin()`, which meant a plain admin client `.update()`
--    could set `payment_status = 'refunded'` today with zero validation,
--    idempotency check, or audit trail — bypassing this whole feature.
--    Tightened below (additive to that one existing function, not a
--    rewrite) so a transition to `refunded`/`partially_refunded` is only
--    ever allowed with a transaction-local flag that only `decide_return`
--    sets — closing the bypass for every caller, including admin.
--
-- ROLLBACK:
--   revoke execute on function public.decide_return(uuid, text, text) from authenticated;
--   drop function public.decide_return(uuid, text, text);
--   revoke execute on function public.respond_to_return(uuid, text, text) from authenticated;
--   drop function public.respond_to_return(uuid, text, text);
--   revoke execute on function public.request_return(uuid, uuid, text, text) from authenticated;
--   drop function public.request_return(uuid, uuid, text, text);
--   drop table public.return_requests;
--   drop type public.return_status;
--   -- restore enforce_order_update_rules's previous body from
--   -- 20260806181324_qr_payment_rpcs.sql / 20260802164203_rls_hardening.sql
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Enumerated type
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.return_status as enum (
    'pending', 'seller_accepted', 'seller_rejected', 'admin_rejected', 'refunded'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- return_requests
-- -----------------------------------------------------------------------------
create table public.return_requests (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id),
  order_item_id         uuid references public.order_items (id),
  buyer_id              uuid not null references public.profiles (id),
  seller_id             uuid not null references public.profiles (id),

  reason                text not null,
  evidence_url          text,
  status                public.return_status not null default 'pending',

  seller_decision_note  text,
  seller_decided_at     timestamptz,
  seller_decided_by     uuid references public.profiles (id),

  admin_decision_note   text,
  admin_decided_at      timestamptz,
  admin_decided_by      uuid references public.profiles (id),

  refund_amount_cents   integer,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint return_requests_reason_length
    check (char_length(reason) between 1 and 500),
  constraint return_requests_evidence_url_scheme
    check (evidence_url is null or evidence_url ~ '^https?://'),
  constraint return_requests_seller_note_length
    check (seller_decision_note is null or char_length(seller_decision_note) <= 500),
  constraint return_requests_admin_note_length
    check (admin_decision_note is null or char_length(admin_decision_note) <= 500),
  constraint return_requests_refund_amount_positive
    check (refund_amount_cents is null or refund_amount_cents > 0)
);

comment on table public.return_requests is
  'Buyer-initiated return/refund lifecycle. RPC-only writes (request_return / respond_to_return / decide_return) — no direct INSERT/UPDATE grant, matching payments/stock_adjustments.';

create index return_requests_order_id_idx on public.return_requests (order_id);
create index return_requests_buyer_id_idx on public.return_requests (buyer_id);
create index return_requests_seller_id_idx on public.return_requests (seller_id);
create index return_requests_status_idx on public.return_requests (status);

-- DB-enforced duplicate-request guard: at most one open request per
-- order/item combination. A whole-order request (order_item_id is null)
-- collapses to the nil UUID sentinel so the partial unique index still
-- applies uniformly.
create unique index return_requests_one_open_per_order_item
  on public.return_requests (
    order_id,
    coalesce(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('pending', 'seller_accepted');

create trigger return_requests_set_updated_at
  before update on public.return_requests
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.return_requests enable row level security;

create policy "buyers sellers and admins read their return requests"
  on public.return_requests for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

-- No INSERT/UPDATE/DELETE policy: every write goes through the three RPCs
-- below, all SECURITY DEFINER, all re-deriving authorization internally.

grant select on public.return_requests to authenticated;
-- No insert/update/delete grant — matches the RLS above.


-- -----------------------------------------------------------------------------
-- RPC: request_return — buyer-only. Order must already be delivered; an
-- optional order_item_id scopes to one line, otherwise the whole order.
-- -----------------------------------------------------------------------------
create or replace function public.request_return(
  p_order_id      uuid,
  p_order_item_id uuid default null,
  p_reason        text default null,
  p_evidence_url  text default null
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
  v_request public.return_requests;
begin
  if v_uid is null then
    raise exception 'You must be signed in to request a return' using errcode = '42501';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'Reason is too long' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to request a return for this order'
      using errcode = '42501';
  end if;
  if v_order.order_status <> 'delivered' then
    raise exception 'Only a delivered order can be returned' using errcode = '22023';
  end if;

  if p_order_item_id is not null then
    if not exists (
      select 1 from public.order_items
      where id = p_order_item_id and order_id = p_order_id
    ) then
      raise exception 'This item does not belong to this order' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id
      and coalesce(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_order_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status in ('pending', 'seller_accepted')
  ) then
    raise exception 'A return request is already open for this order' using errcode = '23514';
  end if;

  insert into public.return_requests (
    order_id, order_item_id, buyer_id, seller_id, reason, evidence_url
  )
  values (
    p_order_id, p_order_item_id, v_uid, v_order.seller_id, trim(p_reason), p_evidence_url
  )
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.request_return is
  'Buyer-only: opens a return/refund request for a delivered order. DB-enforced duplicate guard via return_requests_one_open_per_order_item.';

revoke all on function public.request_return(uuid, uuid, text, text) from public, anon;
grant execute on function public.request_return(uuid, uuid, text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- RPC: respond_to_return — the order's own seller, or admin. Only from
-- 'pending'.
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_return(
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
  v_uid     uuid := (select auth.uid());
  v_request public.return_requests;
begin
  if v_uid is null then
    raise exception 'You must be signed in to respond to a return request'
      using errcode = '42501';
  end if;

  if p_decision not in ('accept', 'reject') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  select * into v_request from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found' using errcode = 'P0002';
  end if;

  if v_uid <> v_request.seller_id and not public.is_admin() then
    raise exception 'You do not have permission to respond to this return request'
      using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This return request has already been responded to'
      using errcode = '23514';
  end if;

  update public.return_requests
  set status = case when p_decision = 'accept' then 'seller_accepted' else 'seller_rejected' end,
      seller_decision_note = p_note,
      seller_decided_at = now(),
      seller_decided_by = v_uid
  where id = p_return_id
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.respond_to_return is
  'Order''s own seller, or admin: accepts/rejects a pending return request. Only valid from pending.';

revoke all on function public.respond_to_return(uuid, text, text) from public, anon;
grant execute on function public.respond_to_return(uuid, text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- RPC: decide_return — admin-only, the sole path to a refund. Only from
-- seller_accepted or seller_rejected (admin may overrule a seller
-- rejection). On approval this both decides AND executes the refund in one
-- atomic call — there is no payment gateway to await settlement from, so a
-- separate "approved but not yet refunded" state would model a step that
-- doesn't exist in this system.
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
  v_uid            uuid := (select auth.uid());
  v_request        public.return_requests;
  v_order          public.orders;
  v_payment        public.payments;
  v_refund_amount  integer;
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

  -- p_decision = 'approve': execute the refund now.
  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select * into v_payment
  from public.payments
  where order_id = v_request.order_id and status = 'paid'
  for update;
  if not found then
    raise exception 'No paid payment found for this order' using errcode = '23514';
  end if;

  if v_request.order_item_id is null then
    v_refund_amount := v_order.total_cents;
  else
    select subtotal_cents into v_refund_amount
    from public.order_items
    where id = v_request.order_item_id;
  end if;

  update public.payments
  set status = 'refunded'
  where id = v_payment.id;

  -- Transaction-local flag: the only way enforce_order_update_rules allows
  -- payment_status to become refunded/partially_refunded, closing the
  -- admin-bypass gap documented at the top of this file.
  perform set_config('app.refund_in_progress', 'true', true);

  update public.orders
  set payment_status = 'refunded'
  where id = v_order.id;

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
      'refund_amount_cents', v_refund_amount
    )
  );

  return v_request;
end;
$$;

comment on function public.decide_return is
  'Admin-only: approves (executes the refund) or rejects a return request already responded to by its seller. Only valid from seller_accepted/seller_rejected — refuses an already-decided request outright.';

revoke all on function public.decide_return(uuid, text, text) from public, anon;
grant execute on function public.decide_return(uuid, text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Tighten enforce_order_update_rules: even is_admin()/service-role callers
-- may only transition payment_status to refunded/partially_refunded when
-- decide_return has set the transaction-local flag immediately before its
-- own write. Every other existing rule in this function is unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or public.is_admin() then
    if new.payment_status is distinct from old.payment_status
       and new.payment_status in ('refunded', 'partially_refunded')
       and coalesce(current_setting('app.refund_in_progress', true), 'false') <> 'true'
    then
      raise exception 'Refunds must go through the return/refund decision flow'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.buyer_id     is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.order_number is distinct from old.order_number
     or new.subtotal_cents is distinct from old.subtotal_cents
     or new.shipping_fee_cents is distinct from old.shipping_fee_cents
     or new.total_cents is distinct from old.total_cents
     or new.currency is distinct from old.currency
  then
    raise exception 'Order financial details cannot be modified'
      using errcode = '42501';
  end if;

  if new.order_status is distinct from old.order_status
     and v_uid <> old.seller_id
     and not (v_uid = old.buyer_id and new.order_status = 'cancelled')
  then
    raise exception 'Only the seller can change fulfilment status'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if v_uid = old.seller_id
       and old.payment_status = 'pending'
       and new.payment_status in ('paid', 'failed')
    then
      null;
    else
      raise exception 'Payment status is set by the payment provider only'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

commit;
