-- =============================================================================
-- Fix: finalize_xendit_group_payment_request and the amount total it feeds
-- (getXenditGroupPaymentTotal, app-layer) were scoped only by
-- checkout_group_id, not by payment_channel. When a buyer started one
-- channel (e.g. GCash), didn't finish it, then switched to another (e.g.
-- Card) -- exactly what the confirmation page's allowSwitchingWhileActive
-- resume UI supports -- both channels' payment rows (one per order, per
-- channel) coexisted under the same checkout_group_id. That made the
-- summed amount double-count across channels, and finalizing the second
-- channel's attempt tried to stamp its Xendit id onto the first channel's
-- rows too, colliding with payments_xendit_payment_request_id_key
-- (unique on xendit_payment_request_id + order_id) once two rows for the
-- same order shared a value.
--
-- Fix: finalize now takes the channel as an explicit parameter and scopes
-- every check and the UPDATE to (checkout_group_id, payment_channel), so
-- finalizing one channel's attempt never touches another channel's rows.
-- begin_xendit_group_payment_attempt's reuse check was already scoped by
-- payment_channel = p_channel_code, so same-channel idempotency (double-
-- click, refresh, second tab) and the insert-a-fresh-channel-on-switch
-- behavior are both already correct and untouched by this migration.
-- =============================================================================

begin;

drop function public.finalize_xendit_group_payment_request(uuid, text, text, timestamptz, text);

create or replace function public.finalize_xendit_group_payment_request(
  p_checkout_group_id         uuid,
  p_channel_code               text,
  p_xendit_payment_request_id text,
  p_checkout_url              text,
  p_expires_at                timestamptz default null,
  p_status                    text default 'pending'
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

  update public.payments
  set xendit_payment_request_id = p_xendit_payment_request_id,
      checkout_url              = p_checkout_url,
      expires_at                = p_expires_at,
      status                    = case when p_status = 'failed' then 'failed'::public.payment_status else status end,
      failure_reason            = case when p_status = 'failed' then 'Xendit rejected the payment request' else failure_reason end
  where checkout_group_id = p_checkout_group_id
    and payment_channel = p_channel_code;

  select * into v_result
  from public.payments
  where checkout_group_id = p_checkout_group_id and payment_channel = p_channel_code
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.finalize_xendit_group_payment_request(uuid, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.finalize_xendit_group_payment_request(uuid, text, text, text, timestamptz, text) to authenticated;

commit;
