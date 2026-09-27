-- =============================================================================
-- Fix surfaced during verification testing: the status CASE expression's two
-- branches are both bare string literals, which Postgres resolves to `text`
-- (not `unknown`) per CASE's common-type rules — `text` does not implicitly
-- cast to the return_status enum on UPDATE assignment, unlike a single plain
-- literal. Explicit casts remove the ambiguity. No behavior change otherwise;
-- unrelated to the is_shop_member widening already applied to this function.
-- =============================================================================

begin;

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

  if v_uid <> v_request.seller_id
     and not public.is_admin()
     and not public.is_shop_member(v_request.shop_id) then
    raise exception 'You do not have permission to respond to this return request'
      using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This return request has already been responded to'
      using errcode = '23514';
  end if;

  update public.return_requests
  set status = case when p_decision = 'accept' then 'seller_accepted' else 'seller_rejected' end::public.return_status,
      seller_decision_note = p_note,
      seller_decided_at = now(),
      seller_decided_by = v_uid
  where id = p_return_id
  returning * into v_request;

  return v_request;
end;
$$;

commit;
