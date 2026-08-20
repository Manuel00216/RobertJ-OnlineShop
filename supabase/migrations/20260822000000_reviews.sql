-- =============================================================================
-- Reviews & Ratings (Buyer UX Improvement Phase — see DECISIONS.md ADR-018):
-- verified-purchase reviews, one per order item. Publicly readable (reviews
-- are meant to be seen by every shopper); write-only through the
-- `submit_review` SECURITY DEFINER RPC below — no direct INSERT/UPDATE/DELETE
-- grant on the table, mirroring `payments`' chokepoint pattern.
--
-- `reviewer_display_name` is a snapshot taken inside the RPC at submission
-- time, not a live join to `profiles`: a buyer's own profile is not publicly
-- readable under existing RLS (`profiles publicly readable by anon`/
-- `profiles readable by authenticated` only expose seller/admin profiles,
-- the caller's own, or a seller's own buyers — see 20260819000000/
-- 20260819000100), so a live join would silently show nothing for most
-- reviewers. This mirrors how `order_items` already snapshots
-- `product_title`/`unit_price_cents` rather than joining `products` live.
--
-- `order_item_id unique` enforces "one review per order item" at the schema
-- level; `on delete restrict` protects review history the same way
-- `order_items.product_id` already protects purchase history.
--
-- No UPDATE/DELETE path in this version — keeping the feature deliberately
-- small (no edit/moderation flow) per the improvement-phase scope.
--
-- ROLLBACK:
--   drop function public.submit_review(uuid, smallint, text);
--   drop table public.reviews;
-- =============================================================================

begin;

create table public.reviews (
  id                     uuid primary key default gen_random_uuid(),
  order_item_id          uuid not null unique references public.order_items (id) on delete restrict,
  product_id             uuid not null references public.products (id) on delete cascade,
  buyer_id               uuid not null references public.profiles (id) on delete cascade,
  reviewer_display_name  text,
  rating                 smallint not null,
  comment                text,
  created_at             timestamptz not null default now(),

  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 1000)
);

create index reviews_product_id_idx on public.reviews (product_id);
create index reviews_buyer_id_idx on public.reviews (buyer_id);

comment on table public.reviews is
  'Verified-purchase reviews, one per order_item. Write-only via submit_review() RPC — see DECISIONS.md ADR-018.';

-- ----------------------------------------------------------------------------
-- RLS: publicly readable (product pages show reviews to every shopper,
-- including guests). No write policy at all — the RPC below is the sole
-- write path, same chokepoint pattern as payments/orders.
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "reviews are publicly readable"
  on public.reviews for select
  to anon, authenticated
  using (true);

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

-- ----------------------------------------------------------------------------
-- submit_review(): verified-purchase gate — re-checks ownership and order
-- status inside the function, never trusts RLS alone (same discipline as
-- submit_qr_payment/verify_payment). Snapshots the reviewer's display name
-- since profiles RLS won't let other shoppers read it later.
-- ----------------------------------------------------------------------------
create or replace function public.submit_review(
  p_order_item_id uuid,
  p_rating smallint,
  p_comment text
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order_item public.order_items;
  v_order public.orders;
  v_profile public.profiles;
  v_review public.reviews;
begin
  if v_uid is null then
    raise exception 'You must be signed in to write a review' using errcode = '42501';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;

  if p_comment is not null and char_length(p_comment) > 1000 then
    raise exception 'Review is too long' using errcode = '22023';
  end if;

  select * into v_order_item
  from public.order_items
  where id = p_order_item_id;

  if not found then
    raise exception 'Order item not found' using errcode = 'P0002';
  end if;

  select * into v_order
  from public.orders
  where id = v_order_item.order_id;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'You do not have permission to review this item'
      using errcode = '42501';
  end if;

  if v_order.order_status <> 'delivered' then
    raise exception 'You can only review items from delivered orders'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.reviews where order_item_id = p_order_item_id
  ) then
    raise exception 'You have already reviewed this item' using errcode = '23505';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid;

  insert into public.reviews (
    order_item_id, product_id, buyer_id, reviewer_display_name, rating, comment
  )
  values (
    p_order_item_id,
    v_order_item.product_id,
    v_uid,
    coalesce(v_profile.full_name, v_profile.username, 'RobertJ Customer'),
    p_rating,
    nullif(trim(p_comment), '')
  )
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, smallint, text) from public;
grant execute on function public.submit_review(uuid, smallint, text) to authenticated;

commit;
