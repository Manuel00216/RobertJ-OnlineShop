-- =============================================================================
-- Corrective follow-up to 20260826000000_returns_and_refunds.sql (already
-- applied) — additive, not an edit to that migration's meaning, per this
-- repo's migration policy ("never edit a released migration").
--
-- `evidence_url` was designed for a public bucket (matching
-- `product_images.url`'s `^https?://` check), but the bucket this feature
-- actually reuses is `payment-receipts` — private, RLS-gated, order-scoped
-- (the exact same ownership shape `return_requests` itself needs) — which
-- stores a Storage *path*, not a public URL, matching
-- `payments.receipt_path`'s existing convention. A public bucket would have
-- meant anyone with the URL could view a buyer's return-evidence photo,
-- which is at least as sensitive as a payment receipt.
--
-- ROLLBACK:
--   drop function public.request_return(uuid, uuid, text, text);
--   -- recreate request_return with p_evidence_url text default null,
--   -- inserting into evidence_url instead of evidence_path
--   alter table public.return_requests drop constraint return_requests_evidence_path_length;
--   alter table public.return_requests add constraint return_requests_evidence_url_scheme
--     check (evidence_url is null or evidence_url ~ '^https?://');
--   alter table public.return_requests rename column evidence_path to evidence_url;
-- =============================================================================

begin;

alter table public.return_requests
  rename column evidence_url to evidence_path;

alter table public.return_requests
  drop constraint return_requests_evidence_url_scheme;

alter table public.return_requests
  add constraint return_requests_evidence_path_length
    check (evidence_path is null or char_length(evidence_path) between 1 and 500);

comment on column public.return_requests.evidence_path is
  'Storage path in the payment-receipts bucket (private) -- resolve via a signed URL, never a public one. Renamed from evidence_url.';

-- Postgres rejects renaming a parameter via CREATE OR REPLACE
-- ("cannot change name of input parameter") — DROP first.
drop function public.request_return(uuid, uuid, text, text);

create function public.request_return(
  p_order_id      uuid,
  p_order_item_id uuid default null,
  p_reason        text default null,
  p_evidence_path text default null
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
    order_id, order_item_id, buyer_id, seller_id, reason, evidence_path
  )
  values (
    p_order_id, p_order_item_id, v_uid, v_order.seller_id, trim(p_reason), p_evidence_path
  )
  returning * into v_request;

  return v_request;
end;
$$;

comment on function public.request_return is
  'Buyer-only: opens a return/refund request for a delivered order. DB-enforced duplicate guard via return_requests_one_open_per_order_item.';

revoke all on function public.request_return(uuid, uuid, text, text) from public, anon;
grant execute on function public.request_return(uuid, uuid, text, text) to authenticated;

commit;
