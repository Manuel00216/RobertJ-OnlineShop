-- =============================================================================
-- p_expires_at (finalize_xendit_payment_request) is legitimately nullable at
-- the SQL level (a GCash/Maya request may have no expiry) but had no
-- DEFAULT, so Supabase's generated TypeScript types marked it as a required
-- non-null string. Adding `default null` makes it optional in the generated
-- types, matching the existing `create_order`/`p_notes` pattern in this
-- codebase (call with `?? undefined` to let Postgres apply the null
-- default) instead of casting away a real type error at the call site. No
-- behavior change — the function already accepted an explicit NULL argument;
-- this only makes omission and the TS types line up with that.
-- =============================================================================

begin;

create or replace function public.finalize_xendit_payment_request(
  p_payment_id                 uuid,
  p_xendit_payment_request_id  text,
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
  v_uid     uuid := (select auth.uid());
  v_payment public.payments;
  v_order   public.orders;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment attempt not found' using errcode = 'P0002';
  end if;

  if v_payment.payment_method_type <> 'xendit' then
    raise exception 'Not a Xendit payment attempt' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to modify this payment'
      using errcode = '42501';
  end if;

  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.finalize_xendit_payment_request(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.finalize_xendit_payment_request(uuid, text, text, timestamptz, text) to authenticated;

commit;
