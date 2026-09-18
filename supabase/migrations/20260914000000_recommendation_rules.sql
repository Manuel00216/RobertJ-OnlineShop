-- =============================================================================
-- Guided Product Selection (Phase 1 — schema + admin/seller rule-authoring
-- only; the buyer-facing quiz is a separate, later phase). Rule-based per
-- DECISIONS.md ADR-009 — explicit, human-authored rows, never AI/ML.
--
-- The SAD's own ERD sketch (ARCHITECTURE.md) is deliberately minimal —
-- `recommendation_rules { id, product_id FK, conditions jsonb }`, explicitly
-- noted as "indicative" column names. This uses explicit typed columns
-- instead of an opaque jsonb blob, matching how every other structured
-- table in this schema (products, orders) already prefers real columns —
-- and matching ADR-009's own "deterministic, explainable" goal.
--
-- Deliberately NOT storing budget on the rule: a stored budget_min/max_cents
-- would drift the moment a seller changes the product's price — the exact
-- staleness risk this schema has repeatedly designed around (cart_items
-- stores no price at all; checkCartAvailability always re-validates live).
-- A rule names *which product* (optionally *which variant*) to recommend for
-- an occasion/size combination; the buyer's stated budget is matched against
-- the product's/variant's live price at query time, in the future
-- buyer-quiz phase — nothing to build here for that.
--
-- Conventions reused verbatim from product_variants.sql (Phase 3a/3b):
--  * seller_id/shop_id ownership, no quantity/stock concept here at all.
--  * RLS shape is an exact structural copy — including the CORRECTED
--    INSERT policy shape from the start. Phase 3b's own audit found the
--    original product_variants INSERT policy wrongly required the literal
--    seller_id, blocking admin/shop-member inserts (fixed in
--    20260912020000_fix_product_variants_insert_rls.sql). This migration
--    starts from that already-corrected shape, not the buggy one.
--  * A dedicated BEFORE INSERT/UPDATE trigger (own function, not shared
--    with cart_items_validate_variant — one trigger per table concern,
--    matching this codebase's existing convention) rejects a variant_id
--    that doesn't belong to product_id. Postgres CHECK constraints can't
--    reference another table.
--
-- ON DELETE CASCADE (not RESTRICT) on product_id/variant_id: a rule is a
-- live marketing configuration, not a financial/historical record —
-- deleting the product/variant it points to should just remove the rule,
-- same reasoning as cart_items.
--
-- No priority/ranking column: the future buyer quiz is expected to return
-- every matching product as a list, not force a single winner — avoids a
-- speculative tie-break column with no current use (YAGNI, same reasoning
-- shop_users already documented for skipping a membership-role column).
--
-- ROLLBACK:
--   drop table public.recommendation_rules;
--   drop function public.recommendation_rules_validate_variant();
--   drop type public.recommendation_occasion;
-- =============================================================================

begin;

create type public.recommendation_occasion as enum (
  'casual', 'formal', 'work', 'sportswear', 'party', 'wedding', 'everyday'
);

create table public.recommendation_rules (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  variant_id   uuid references public.product_variants (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  shop_id      uuid references public.shops (id),

  -- null = matches any occasion.
  occasion     public.recommendation_occasion,
  -- null = matches any size. Free text, same convention as
  -- product_variants.size — garment sizing isn't one fixed vocabulary
  -- (S/M/L for shirts, numeric for shoes, etc.).
  size         text,

  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint recommendation_rules_size_length check (size is null or char_length(size) <= 60)
);

comment on table public.recommendation_rules is
  'Explicit, human-authored Guided Product Selection rules (ADR-009 — not AI/ML). Each row: recommend product_id (optionally a specific variant_id) when a buyer''s occasion/size answers match. Budget is matched against live product/variant price at query time, never stored here.';

create index recommendation_rules_product_id_idx on public.recommendation_rules (product_id);
create index recommendation_rules_seller_id_idx on public.recommendation_rules (seller_id);
create index recommendation_rules_shop_id_idx on public.recommendation_rules (shop_id);
create index recommendation_rules_occasion_idx on public.recommendation_rules (occasion);

create trigger recommendation_rules_set_updated_at
  before update on public.recommendation_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cross-table integrity: a rule's variant must belong to its product. Own
-- function (not shared with cart_items_validate_variant) — plain trigger,
-- SECURITY INVOKER (the default, stated explicitly per this codebase's
-- convention), not an RPC or SECURITY DEFINER function. Runs as the calling
-- user; product_variants is already readable to any seller/admin/shop-member
-- for exactly the rows that matter here.
-- -----------------------------------------------------------------------------
create or replace function public.recommendation_rules_validate_variant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.variant_id is not null then
    if not exists (
      select 1
      from public.product_variants v
      where v.id = new.variant_id
        and v.product_id = new.product_id
    ) then
      raise exception 'Variant % does not belong to product %', new.variant_id, new.product_id
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.recommendation_rules_validate_variant is
  'BEFORE INSERT/UPDATE trigger on recommendation_rules: rejects a row whose variant_id does not belong to its product_id. Plain SECURITY INVOKER trigger, not an RPC or SECURITY DEFINER function.';

create trigger recommendation_rules_validate_variant
  before insert or update of product_id, variant_id on public.recommendation_rules
  for each row execute function public.recommendation_rules_validate_variant();

-- -----------------------------------------------------------------------------
-- RLS — exact structural copy of product_variants' policies.
-- -----------------------------------------------------------------------------
alter table public.recommendation_rules enable row level security;

create policy "active rules of active products are publicly readable"
  on public.recommendation_rules for select
  to anon
  using (
    active
    and exists (
      select 1 from public.products p
      where p.id = recommendation_rules.product_id and p.status = 'active'
    )
  );

create policy "buyers read active rules, sellers read their own"
  on public.recommendation_rules for select
  to authenticated
  using (
    (
      active
      and exists (
        select 1 from public.products p
        where p.id = recommendation_rules.product_id and p.status = 'active'
      )
    )
    or seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

create policy "sellers insert their own rules"
  on public.recommendation_rules for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and public.current_user_role() in ('seller', 'admin')
    and (shop_id is null or public.is_shop_member(shop_id) or public.is_admin())
    and exists (
      select 1 from public.products p
      where p.id = recommendation_rules.product_id and p.seller_id = recommendation_rules.seller_id
    )
  );

create policy "sellers update their own rules"
  on public.recommendation_rules for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  )
  with check (
    (seller_id = (select auth.uid()) or public.is_shop_member(shop_id) or public.is_admin())
    and exists (
      select 1 from public.products p
      where p.id = recommendation_rules.product_id and p.seller_id = recommendation_rules.seller_id
    )
  );

create policy "sellers delete their own rules"
  on public.recommendation_rules for delete
  to authenticated
  using (
    seller_id = (select auth.uid())
    or public.is_shop_member(shop_id)
    or public.is_admin()
  );

revoke all on public.recommendation_rules from anon, authenticated;
grant select on public.recommendation_rules to anon, authenticated;
grant insert, update, delete on public.recommendation_rules to authenticated;

commit;
