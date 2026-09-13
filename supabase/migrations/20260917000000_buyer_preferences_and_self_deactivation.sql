-- =============================================================================
-- Buyer Preferences + Self-Service Account Deactivation (Privacy & Settings).
--
-- `buyer_preferences`: one row per buyer holding the two things Privacy &
-- Settings needs that don't already live anywhere else — notification
-- toggles and a default checkout payment method. Plain-RLS, non-RPC-gated,
-- same justification as `addresses`/`wishlists`: every write is a pure
-- `user_id`-owned row with no cross-entity invariant to protect. A missing
-- row means "defaults", not "unset" — the service layer treats a
-- no-row-found read as the same defaults the columns declare, so a first
-- write is a plain upsert, never a separate create-then-update dance.
--
-- `default_payment_method` is deliberately `text` + an explicit CHECK for
-- exactly `('cod','xendit')` — NOT the existing `payment_method_type` enum,
-- which also contains retired/internal values (`card`, `qr_upload`) that are
-- no longer offered as a checkout choice (see `checkout.types.ts`'s
-- `PaymentMethod` union). Reusing that enum here would let a preference be
-- set to a value the checkout UI can't even offer.
--
-- `self_deactivate_account()`: mirrors `admin_set_user_active`'s shape
-- (20260825000000_account_activation.sql) but scoped the other way —
-- a buyer acting on themselves, not an admin acting on someone else.
-- Restricted to `role = 'buyer'` on purpose: sellers/admins have
-- active-listing/order-management complexity that only case-by-case admin
-- judgment currently handles (see the admin deactivation flow), so they're
-- told to contact an administrator instead of getting a self-service path
-- here. Reuses `admin_action_log` for the audit trail (actor = target = the
-- caller, action = 'self_deactivate_account') rather than inventing a
-- separate log.
--
-- ROLLBACK:
--   revoke execute on function public.self_deactivate_account() from authenticated;
--   drop function public.self_deactivate_account();
--   drop table public.buyer_preferences;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- buyer_preferences
-- -----------------------------------------------------------------------------
create table public.buyer_preferences (
  user_id               uuid primary key references public.profiles (id) on delete cascade,

  order_updates         boolean not null default true,
  promotions            boolean not null default true,
  push_enabled          boolean not null default false,
  email_enabled         boolean not null default true,
  sms_enabled           boolean not null default false,

  default_payment_method text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint buyer_preferences_default_payment_method_check
    check (default_payment_method is null or default_payment_method in ('cod', 'xendit'))
);

comment on table public.buyer_preferences is
  'One row per buyer: notification toggles + default checkout payment method. A missing row means "use defaults", not "unset" — see this migration''s header comment.';

create trigger buyer_preferences_set_updated_at
  before update on public.buyer_preferences
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: a buyer manages only their own preferences row. No admin/seller
-- override, no delete policy (a preference is overwritten, never removed
-- independently of the account itself) — same posture as `addresses`.
-- -----------------------------------------------------------------------------
alter table public.buyer_preferences enable row level security;

create policy "users read their own preferences"
  on public.buyer_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert their own preferences"
  on public.buyer_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their own preferences"
  on public.buyer_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.buyer_preferences from anon, authenticated;
grant select, insert, update on public.buyer_preferences to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: self_deactivate_account — the sole write path for a buyer
-- deactivating their own account. Explicitly re-derives the caller's own
-- role/state inside the function — never trusts RLS alone.
-- -----------------------------------------------------------------------------
create or replace function public.self_deactivate_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'You must be signed in to perform this action' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if v_profile.role <> 'buyer' then
    raise exception 'Please contact an administrator to deactivate this account' using errcode = '22023';
  end if;

  if not v_profile.is_active then
    raise exception 'This account is already deactivated' using errcode = '22023';
  end if;

  update public.profiles
  set is_active = false
  where id = v_uid;

  insert into public.admin_action_log (
    actor_id, action, target_user_id, metadata
  )
  values (
    v_uid, 'self_deactivate_account', v_uid, jsonb_build_object('previous_active', true, 'new_active', false)
  );
end;
$$;

comment on function public.self_deactivate_account is
  'Sole write path for a buyer deactivating their own account. Rejects non-buyer callers and already-inactive accounts; logs to admin_action_log with actor = target = caller.';

revoke all on function public.self_deactivate_account() from public, anon;
grant execute on function public.self_deactivate_account() to authenticated;

commit;
